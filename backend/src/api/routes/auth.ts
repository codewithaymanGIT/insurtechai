import { Router } from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../middleware/errorHandler";
import { authConfig } from "../../auth/config";
import { emailDeliveryMode } from "../../auth/email";
import { requestSignInCode, verifySignInCode } from "../../auth/otp";
import { verifyGoogleCredential } from "../../auth/google";
import { upsertVerifiedUser } from "../../auth/users";
import { createSession, destroySession } from "../../auth/sessions";
import { startMfaChallenge, completeMfaChallenge } from "../../auth/mfa";
import { db } from "../../db/client";
import * as schema from "../../db/schema";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { tr } from "../../i18n";

/** After a verified first factor: either start a session, or (if the user
 * has authenticator 2FA on) ask for the second factor first. */
async function finishSignIn(req: Request, res: Response, userId: string) {
  const user = await db.select({ totpEnabledAt: schema.users.totpEnabledAt, termsAcceptedAt: schema.users.termsAcceptedAt }).from(schema.users).where(eq(schema.users.id, userId)).get();
  if (user?.totpEnabledAt) {
    await startMfaChallenge(res, userId);
    res.json({ status: "mfa" });
    return;
  }
  await createSession(req, res, userId);
  res.json({ status: user?.termsAcceptedAt ? "ok" : "profile" });
}

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
  message: () => ({ error: "RATE_LIMITED", message: tr("Too many sign-in attempts. Please wait a few minutes.") }),
});

const emailSchema = z.object({ email: z.string().trim().email().max(254) });
const verifySchema = z.object({ email: z.string().trim().email().max(254), code: z.string().trim().length(6) });
const googleSchema = z.object({ credential: z.string().min(20).max(5000) });

// What sign-in methods this server supports, so the UI only shows working options.
authRouter.get("/config", (_req, res) => {
  res.json({
    googleClientId: authConfig.googleClientId,
    emailCodes: emailDeliveryMode() !== "unavailable",
    emailDelivery: emailDeliveryMode(),
    ai: {
      enabled: !!process.env.GEMINI_API_KEY?.trim(),
      // Free-tier Gemini content may be used by Google to improve its products.
      tier: process.env.GEMINI_PAID_TIER === "true" ? "paid" : "free",
    },
  });
});

authRouter.get("/me", (req, res) => {
  res.json({ user: req.user ?? null });
});

authRouter.post(
  "/email/request",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email } = emailSchema.parse(req.body);
    const { resendAfterSeconds } = await requestSignInCode(email, req.ip);
    res.json({ ok: true, resendAfterSeconds });
  }),
);

authRouter.post(
  "/email/verify",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, code } = verifySchema.parse(req.body);
    const verifiedEmail = await verifySignInCode(email, code);
    const userId = await upsertVerifiedUser({ email: verifiedEmail });
    await finishSignIn(req, res, userId);
  }),
);

authRouter.post(
  "/google",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { credential } = googleSchema.parse(req.body);
    const identity = await verifyGoogleCredential(credential);
    const userId = await upsertVerifiedUser(identity);
    await finishSignIn(req, res, userId);
  }),
);

const mfaSchema = z.union([
  z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") }),
  z.object({ recoveryCode: z.string().trim().min(8).max(40) }),
]);

// Second step for accounts with authenticator 2FA.
authRouter.post(
  "/mfa",
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = mfaSchema.parse(req.body);
    const userId = await completeMfaChallenge(req, res, input);
    await createSession(req, res, userId);
    const user = await db.select({ termsAcceptedAt: schema.users.termsAcceptedAt }).from(schema.users).where(eq(schema.users.id, userId)).get();
    res.json({ status: user?.termsAcceptedAt ? "ok" : "profile" });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await destroySession(res, req.sessionId);
    res.json({ ok: true });
  }),
);

export default authRouter;
