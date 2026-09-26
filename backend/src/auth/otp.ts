import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../db/client";
import * as schema from "../db/schema";
import { authConfig } from "./config";
import { hashOtp, newOtpCode, normalizeEmail, safeEqualHex } from "./tokens";
import { sendSignInCode } from "./email";
import { ApiError } from "../api/middleware/errorHandler";
import { tr } from "../i18n";

export async function requestSignInCode(rawEmail: string, ip: string | undefined): Promise<{ resendAfterSeconds: number }> {
  const email = normalizeEmail(rawEmail);
  const now = Date.now();

  const latest = await db
    .select({ createdAt: schema.emailOtps.createdAt })
    .from(schema.emailOtps)
    .where(eq(schema.emailOtps.email, email))
    .orderBy(desc(schema.emailOtps.createdAt))
    .get();
  if (latest) {
    const elapsed = (now - new Date(latest.createdAt).getTime()) / 1000;
    if (elapsed < authConfig.otpResendSeconds) {
      const wait = Math.ceil(authConfig.otpResendSeconds - elapsed);
      throw new ApiError(429, tr("Please wait {n} seconds before requesting another code.", { n: wait }));
    }
  }

  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const recent = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.emailOtps)
    .where(and(eq(schema.emailOtps.email, email), gt(schema.emailOtps.createdAt, hourAgo)))
    .get();
  if ((recent?.n ?? 0) >= authConfig.otpMaxPerHour) {
    throw new ApiError(429, tr("Too many codes requested for this email. Try again in an hour."));
  }

  // Invalidate any earlier unused codes so only the newest one works.
  await db
    .update(schema.emailOtps)
    .set({ consumedAt: new Date(now).toISOString() })
    .where(and(eq(schema.emailOtps.email, email), isNull(schema.emailOtps.consumedAt)))
    .run();

  const code = newOtpCode();
  await db.insert(schema.emailOtps).values({
    email,
    codeHash: hashOtp(email, code),
    expiresAt: new Date(now + authConfig.otpTtlMinutes * 60 * 1000).toISOString(),
    ip: ip ?? null,
    createdAt: new Date(now).toISOString(),
  }).run();

  try {
    await sendSignInCode(email, code);
  } catch (err) {
    console.error("[auth] Failed to send sign-in email:", err);
    throw new ApiError(503, tr("We couldn't send the email just now. Please try again, or continue with Google."));
  }

  return { resendAfterSeconds: authConfig.otpResendSeconds };
}

/** Returns the verified, normalized email on success; throws otherwise. */
export async function verifySignInCode(rawEmail: string, code: string): Promise<string> {
  const email = normalizeEmail(rawEmail);
  const nowIso = new Date().toISOString();

  const row = await db
    .select()
    .from(schema.emailOtps)
    .where(and(eq(schema.emailOtps.email, email), isNull(schema.emailOtps.consumedAt), gt(schema.emailOtps.expiresAt, nowIso)))
    .orderBy(desc(schema.emailOtps.createdAt))
    .get();

  const invalid = new ApiError(400, tr("That code is incorrect or has expired."));
  if (!row) throw invalid;

  if (row.attempts >= authConfig.otpMaxAttempts) {
    await db.update(schema.emailOtps).set({ consumedAt: nowIso }).where(eq(schema.emailOtps.id, row.id)).run();
    throw new ApiError(429, tr("Too many incorrect attempts. Request a new code."));
  }

  if (!/^\d{6}$/.test(code) || !safeEqualHex(row.codeHash, hashOtp(email, code))) {
    await db.update(schema.emailOtps).set({ attempts: row.attempts + 1 }).where(eq(schema.emailOtps.id, row.id)).run();
    throw invalid;
  }

  await db.update(schema.emailOtps).set({ consumedAt: nowIso }).where(eq(schema.emailOtps.id, row.id)).run();
  return email;
}
