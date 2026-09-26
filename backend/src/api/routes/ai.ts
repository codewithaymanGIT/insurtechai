import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { and, eq, gt, sql } from "drizzle-orm";
import { parseApplicantProfile, parseAdvisorRequest, parseChatRequest } from "../validation";
import { runFullAssessment } from "../../engine/assess";
import { explainRiskFactors, answerAdvisorQuestion } from "../../engine/advisor";
import { askLlmAdvisor } from "../../services/llmAdvisor";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth } from "../../auth/middleware";
import { authConfig } from "../../auth/config";
import { db } from "../../db/client";
import * as schema from "../../db/schema";
import { tr } from "../../i18n";

export const aiRouter = Router();

// POST /api/ai/explain: plain-language explanation of a given applicant's score
aiRouter.post(
  "/explain",
  asyncHandler(async (req, res) => {
    const applicant = parseApplicantProfile(req.body);
    const result = runFullAssessment(applicant);
    res.json({ explanation: explainRiskFactors(result), result });
  }),
);

// POST /api/ai/advisor: the six preset questions, answered from the applicant's
// own computed assessment (engine/advisor.ts). Free, no account needed.
aiRouter.post(
  "/advisor",
  asyncHandler(async (req, res) => {
    const { questionId, applicant } = parseAdvisorRequest(req.body);
    const result = runFullAssessment(applicant);
    res.json({ questionId, answer: answerAdvisorQuestion(questionId, result) });
  }),
);

// Burst protection on top of the daily quota below.
const chatBurstLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 6,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => `chat:${req.user?.id}`,
  message: () => ({ available: false, reply: null, interactionId: null, error: tr("You're sending questions quickly. Wait a moment and try again.") }),
});

// Conversation IDs issued to each user, so one user can't continue another's
// conversation by sending its ID. In-memory: a restart just starts fresh chats.
const conversationOwner = new Map<string, { userId: string; at: number }>();
function ownsConversation(id: string | undefined, userId: string): boolean {
  if (!id) return false;
  const entry = conversationOwner.get(id);
  return !!entry && entry.userId === userId && Date.now() - entry.at < 6 * 60 * 60 * 1000;
}
function rememberConversation(id: string, userId: string) {
  conversationOwner.set(id, { userId, at: Date.now() });
  if (conversationOwner.size > 5000) {
    const oldest = [...conversationOwner.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 1000);
    for (const [k] of oldest) conversationOwner.delete(k);
  }
}

// POST /api/ai/chat: free-form question answered by Gemini, grounded in the
// applicant's computed data. Requires sign-in; metered per user per day.
aiRouter.post(
  "/chat",
  requireAuth,
  chatBurstLimiter,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { applicant, question, previousInteractionId } = parseChatRequest(req.body);

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const used = await db
      .select({ n: sql<number>`count(*)` })
      .from(schema.usageEvents)
      .where(and(eq(schema.usageEvents.userId, userId), eq(schema.usageEvents.kind, "CHAT"), gt(schema.usageEvents.createdAt, dayAgo)))
      .get();
    if ((used?.n ?? 0) >= authConfig.chatDailyLimit) {
      res.status(429).json({
        available: false, reply: null, interactionId: null,
        error: tr("You've reached today's limit of {n} questions. It resets over the next 24 hours.", { n: authConfig.chatDailyLimit }),
      });
      return;
    }

    // Only meter real model calls (no key configured = nothing to meter).
    if (process.env.GEMINI_API_KEY?.trim()) {
      await db.insert(schema.usageEvents).values({ userId, kind: "CHAT", createdAt: new Date().toISOString() }).run();
    }

    const result = runFullAssessment(applicant);
    const continueFrom = ownsConversation(previousInteractionId, userId) ? previousInteractionId : undefined;
    const chat = await askLlmAdvisor(applicant, result, question, continueFrom);
    if (chat.interactionId) rememberConversation(chat.interactionId, userId);

    res.json({ ...chat, remainingToday: Math.max(0, authConfig.chatDailyLimit - (used?.n ?? 0) - 1) });
  }),
);

export default aiRouter;
