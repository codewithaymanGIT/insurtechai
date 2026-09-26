import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../../db/client";
import { requireAdmin, requireAuth } from "../../auth/middleware";
import { asyncHandler } from "../middleware/errorHandler";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

// GET /api/admin/usage: counts only, no personal data.
adminRouter.get(
  "/usage",
  asyncHandler(async (_req, res) => {
    const one = async (q: ReturnType<typeof sql>) => (await db.get<{ n: number }>(q))?.n ?? 0;
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [users, newUsersWeek, activeSessions, savedEstimates, chats24h, chats7d] = await Promise.all([
      one(sql`SELECT COUNT(*) n FROM users`),
      one(sql`SELECT COUNT(*) n FROM users WHERE created_at > ${weekAgo.replace("T", " ").slice(0, 19)}`),
      one(sql`SELECT COUNT(*) n FROM sessions WHERE expires_at > ${new Date().toISOString()}`),
      one(sql`SELECT COUNT(*) n FROM saved_assessments`),
      one(sql`SELECT COUNT(*) n FROM usage_events WHERE kind = 'CHAT' AND created_at > ${dayAgo}`),
      one(sql`SELECT COUNT(*) n FROM usage_events WHERE kind = 'CHAT' AND created_at > ${weekAgo}`),
    ]);

    const byType = await db.all<{ insuranceType: string; n: number }>(
      sql`SELECT insurance_type as insuranceType, COUNT(*) n FROM saved_assessments GROUP BY insurance_type`,
    );

    res.json({ users, newUsersWeek, activeSessions, savedEstimates, chats24h, chats7d, estimatesByType: byType });
  }),
);

export default adminRouter;
