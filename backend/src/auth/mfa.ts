import type { Request, Response } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db/client";
import * as schema from "../db/schema";
import { authConfig, isProduction } from "./config";
import { newSessionToken, sha256 } from "./tokens";
import { decryptSecret, newRecoveryCodes, normalizeRecoveryCode, verifyTotp } from "./totp";
import { ApiError } from "../api/middleware/errorHandler";
import { tr } from "../i18n";

const CHALLENGE_COOKIE = isProduction ? "__Host-itai_mfa" : "itai_mfa";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/** After the first factor succeeds for a user with 2FA on: park the sign-in
 * in a 5-minute challenge instead of creating a session. */
export async function startMfaChallenge(res: Response, userId: string): Promise<void> {
  const token = newSessionToken();
  await db.insert(schema.mfaChallenges).values({
    id: sha256(token),
    userId,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
    createdAt: new Date().toISOString(),
  }).run();
  res.cookie(CHALLENGE_COOKIE, token, { httpOnly: true, secure: isProduction, sameSite: "lax", path: "/", maxAge: CHALLENGE_TTL_MS });
}

/** Checks the pending challenge against an authenticator or recovery code.
 * Returns the user id on success; the challenge is consumed either way once
 * it succeeds or runs out of attempts. */
export async function completeMfaChallenge(req: Request, res: Response, input: { code?: string; recoveryCode?: string }): Promise<string> {
  const token = req.cookies?.[CHALLENGE_COOKIE];
  const expired = new ApiError(401, tr("Your sign-in timed out. Please start again."));
  if (typeof token !== "string") throw expired;

  const id = sha256(token);
  const ch = await db
    .select()
    .from(schema.mfaChallenges)
    .where(and(eq(schema.mfaChallenges.id, id), gt(schema.mfaChallenges.expiresAt, new Date().toISOString())))
    .get();
  if (!ch) throw expired;

  if (ch.attempts >= MAX_ATTEMPTS) {
    await db.delete(schema.mfaChallenges).where(eq(schema.mfaChallenges.id, id)).run();
    res.clearCookie(CHALLENGE_COOKIE, { path: "/" });
    throw new ApiError(429, tr("Too many wrong codes. Please sign in again."));
  }

  const ok = input.recoveryCode
    ? await useRecoveryCode(ch.userId, input.recoveryCode)
    : await checkUserTotp(ch.userId, input.code ?? "");

  if (!ok) {
    await db.update(schema.mfaChallenges).set({ attempts: ch.attempts + 1 }).where(eq(schema.mfaChallenges.id, id)).run();
    throw new ApiError(400, input.recoveryCode ? tr("That recovery code isn't valid or was already used.") : tr("That code is incorrect. Check your authenticator app and try again."));
  }

  await db.delete(schema.mfaChallenges).where(eq(schema.mfaChallenges.id, id)).run();
  res.clearCookie(CHALLENGE_COOKIE, { path: "/" });
  return ch.userId;
}

/** Verifies a 6-digit authenticator code for a user with 2FA enabled and
 * records the time step so the same code can't be replayed. */
export async function checkUserTotp(userId: string, code: string): Promise<boolean> {
  const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!user?.totpSecretEnc) return false;
  const step = verifyTotp(decryptSecret(user.totpSecretEnc), code.trim(), user.totpLastStep ?? null);
  if (step === null) return false;
  await db.update(schema.users).set({ totpLastStep: step }).where(eq(schema.users.id, userId)).run();
  return true;
}

export async function useRecoveryCode(userId: string, code: string): Promise<boolean> {
  const hash = sha256(`${authConfig.secret}:${normalizeRecoveryCode(code)}`);
  const row = await db
    .select()
    .from(schema.recoveryCodes)
    .where(and(eq(schema.recoveryCodes.userId, userId), eq(schema.recoveryCodes.codeHash, hash), isNull(schema.recoveryCodes.usedAt)))
    .get();
  if (!row) return false;
  await db.update(schema.recoveryCodes).set({ usedAt: new Date().toISOString() }).where(eq(schema.recoveryCodes.id, row.id)).run();
  return true;
}

/** Replaces any existing recovery codes; returns the new plain codes (shown once). */
export async function issueRecoveryCodes(userId: string): Promise<string[]> {
  const codes = newRecoveryCodes();
  await db.delete(schema.recoveryCodes).where(eq(schema.recoveryCodes.userId, userId)).run();
  await db.insert(schema.recoveryCodes).values(
    codes.map((c) => ({ userId, codeHash: sha256(`${authConfig.secret}:${normalizeRecoveryCode(c)}`), createdAt: new Date().toISOString() })),
  ).run();
  return codes;
}

export async function remainingRecoveryCodes(userId: string): Promise<number> {
  const rows = await db
    .select({ id: schema.recoveryCodes.id })
    .from(schema.recoveryCodes)
    .where(and(eq(schema.recoveryCodes.userId, userId), isNull(schema.recoveryCodes.usedAt)))
    .all();
  return rows.length;
}
