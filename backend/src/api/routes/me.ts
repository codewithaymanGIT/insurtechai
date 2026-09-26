import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import * as schema from "../../db/schema";
import { requireAuth } from "../../auth/middleware";
import { destroySession, listSessions, revokeOtherSessions, revokeSession } from "../../auth/sessions";
import { z } from "zod";
import QRCode from "qrcode";
import { rateLimit } from "express-rate-limit";
import { decryptSecret, encryptSecret, newTotpSecret, totpAuthUri, verifyTotp } from "../../auth/totp";
import { checkUserTotp, issueRecoveryCodes, remainingRecoveryCodes, useRecoveryCode } from "../../auth/mfa";
import { ApiError, asyncHandler } from "../middleware/errorHandler";
import { tr } from "../../i18n";

export const meRouter = Router();
meRouter.use(requireAuth);

// GET /api/me/assessments: the signed-in user's saved estimates, newest first.
meRouter.get(
  "/assessments",
  asyncHandler(async (req, res) => {
    const rows = await db
      .select({
        id: schema.savedAssessments.id,
        insuranceType: schema.savedAssessments.insuranceType,
        riskScore: schema.savedAssessments.riskScore,
        finalPremium: schema.savedAssessments.finalPremium,
        createdAt: schema.savedAssessments.createdAt,
      })
      .from(schema.savedAssessments)
      .where(eq(schema.savedAssessments.userId, req.user!.id))
      .orderBy(desc(schema.savedAssessments.createdAt))
      .limit(100)
      .all();
    res.json({ assessments: rows });
  }),
);

meRouter.get(
  "/assessments/:id",
  asyncHandler(async (req, res) => {
    const row = await db
      .select()
      .from(schema.savedAssessments)
      .where(and(eq(schema.savedAssessments.id, req.params.id), eq(schema.savedAssessments.userId, req.user!.id)))
      .get();
    if (!row) throw new ApiError(404, tr("Estimate not found."));
    res.json({
      id: row.id,
      createdAt: row.createdAt,
      applicant: JSON.parse(row.applicantJson),
      result: JSON.parse(row.resultJson),
    });
  }),
);

meRouter.delete(
  "/assessments/:id",
  asyncHandler(async (req, res) => {
    await db
      .delete(schema.savedAssessments)
      .where(and(eq(schema.savedAssessments.id, req.params.id), eq(schema.savedAssessments.userId, req.user!.id)))
      .run();
    res.json({ ok: true });
  }),
);

// DELETE /api/me: permanently deletes the account and everything tied to it
// (sessions, saved estimates, usage records cascade via foreign keys).
meRouter.delete(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    await db.delete(schema.savedAssessments).where(eq(schema.savedAssessments.userId, userId)).run();
    await db.delete(schema.usageEvents).where(eq(schema.usageEvents.userId, userId)).run();
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run();
    await db.delete(schema.recoveryCodes).where(eq(schema.recoveryCodes.userId, userId)).run();
    await db.delete(schema.mfaChallenges).where(eq(schema.mfaChallenges.userId, userId)).run();
    await db.delete(schema.users).where(eq(schema.users.id, userId)).run();
    await destroySession(res, undefined);
    res.json({ ok: true });
  }),
);

// --- Profile / signup completion --------------------------------------------

const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  acceptTerms: z.boolean().optional(),
});

meRouter.post(
  "/profile",
  asyncHandler(async (req, res) => {
    const { name, acceptTerms } = profileSchema.parse(req.body);
    const user = await db.select({ termsAcceptedAt: schema.users.termsAcceptedAt }).from(schema.users).where(eq(schema.users.id, req.user!.id)).get();
    if (!user?.termsAcceptedAt && acceptTerms !== true) throw new ApiError(400, tr("Please agree to the terms to finish creating your account."));
    await db
      .update(schema.users)
      .set({ name, ...(user?.termsAcceptedAt ? {} : { termsAcceptedAt: new Date().toISOString() }) })
      .where(eq(schema.users.id, req.user!.id))
      .run();
    res.json({ ok: true });
  }),
);

// --- Security overview -----------------------------------------------------

meRouter.get(
  "/security",
  asyncHandler(async (req, res) => {
    const [sessions, codesLeft] = await Promise.all([listSessions(req.user!.id, req.sessionId), remainingRecoveryCodes(req.user!.id)]);
    res.json({ mfaEnabled: req.user!.mfaEnabled, recoveryCodesLeft: req.user!.mfaEnabled ? codesLeft : 0, sessions });
  }),
);

// --- Authenticator 2FA -----------------------------------------------------

const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => `mfa:${req.user?.id}`,
  message: () => ({ error: "RATE_LIMITED", message: tr("Too many attempts. Wait a few minutes and try again.") }),
});

const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") });
const codeOrRecovery = z.union([codeSchema, z.object({ recoveryCode: z.string().trim().min(8).max(40) })]);

meRouter.post(
  "/2fa/setup",
  mfaLimiter,
  asyncHandler(async (req, res) => {
    if (req.user!.mfaEnabled) throw new ApiError(400, tr("Two-factor authentication is already on."));
    const secret = newTotpSecret();
    await db.update(schema.users).set({ totpPendingEnc: encryptSecret(secret) }).where(eq(schema.users.id, req.user!.id)).run();
    const uri = totpAuthUri(secret, req.user!.email);
    const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220, errorCorrectionLevel: "M" });
    res.json({ qr, secret, uri });
  }),
);

meRouter.post(
  "/2fa/enable",
  mfaLimiter,
  asyncHandler(async (req, res) => {
    const { code } = codeSchema.parse(req.body);
    const user = await db.select().from(schema.users).where(eq(schema.users.id, req.user!.id)).get();
    if (!user?.totpPendingEnc) throw new ApiError(400, tr("Start the setup again."));
    const secret = decryptSecret(user.totpPendingEnc);
    const step = verifyTotp(secret, code, null);
    if (step === null) throw new ApiError(400, tr("That code didn't match. Check the time on your phone is set automatically, then try the newest code."));
    await db
      .update(schema.users)
      .set({ totpSecretEnc: user.totpPendingEnc, totpPendingEnc: null, totpEnabledAt: new Date().toISOString(), totpLastStep: step })
      .where(eq(schema.users.id, req.user!.id))
      .run();
    const recoveryCodes = await issueRecoveryCodes(req.user!.id);
    res.json({ recoveryCodes });
  }),
);

async function checkSecondFactor(userId: string, input: z.infer<typeof codeOrRecovery>) {
  const ok = "recoveryCode" in input ? await useRecoveryCode(userId, input.recoveryCode) : await checkUserTotp(userId, input.code);
  if (!ok) throw new ApiError(400, tr("That code is incorrect."));
}

meRouter.post(
  "/2fa/disable",
  mfaLimiter,
  asyncHandler(async (req, res) => {
    if (!req.user!.mfaEnabled) throw new ApiError(400, tr("Two-factor authentication is already off."));
    await checkSecondFactor(req.user!.id, codeOrRecovery.parse(req.body));
    await db
      .update(schema.users)
      .set({ totpSecretEnc: null, totpPendingEnc: null, totpEnabledAt: null, totpLastStep: null })
      .where(eq(schema.users.id, req.user!.id))
      .run();
    await db.delete(schema.recoveryCodes).where(eq(schema.recoveryCodes.userId, req.user!.id)).run();
    res.json({ ok: true });
  }),
);

meRouter.post(
  "/2fa/recovery-codes",
  mfaLimiter,
  asyncHandler(async (req, res) => {
    if (!req.user!.mfaEnabled) throw new ApiError(400, tr("Turn on two-factor authentication first."));
    await checkSecondFactor(req.user!.id, codeSchema.parse(req.body));
    res.json({ recoveryCodes: await issueRecoveryCodes(req.user!.id) });
  }),
);

// --- Signed-in devices -----------------------------------------------------

meRouter.delete(
  "/sessions/:id",
  asyncHandler(async (req, res) => {
    await revokeSession(req.user!.id, req.params.id);
    res.json({ ok: true });
  }),
);

meRouter.post(
  "/sessions/revoke-others",
  asyncHandler(async (req, res) => {
    res.json({ revoked: await revokeOtherSessions(req.user!.id, req.sessionId) });
  }),
);

export default meRouter;
