import type { Request, Response, CookieOptions } from "express";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "../db/client";
import * as schema from "../db/schema";
import { authConfig, isProduction } from "./config";
import { newSessionToken, sha256 } from "./tokens";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  avatarUrl: string | null;
  /** Signed in but hasn't finished signup (name + terms) yet. */
  needsProfile: boolean;
  mfaEnabled: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function cookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeMs,
  };
}

export async function createSession(req: Request, res: Response, userId: string): Promise<void> {
  const token = newSessionToken();
  const now = new Date();
  const ttl = authConfig.sessionTtlDays * DAY_MS;
  await db.insert(schema.sessions).values({
    id: sha256(token),
    userId,
    expiresAt: new Date(now.getTime() + ttl).toISOString(),
    lastSeenAt: now.toISOString(),
    userAgent: req.get("user-agent")?.slice(0, 300) ?? null,
    ip: req.ip ?? null,
  }).run();
  await db.update(schema.users).set({ lastLoginAt: now.toISOString() }).where(eq(schema.users.id, userId)).run();
  res.cookie(authConfig.sessionCookieName, token, cookieOptions(ttl));
}

/** Resolves the session cookie to a user. Extends the session (sliding
 * expiry) once it's past its halfway point, so active users stay signed in. */
export async function readSession(req: Request, res: Response): Promise<{ sessionId: string; user: SessionUser } | null> {
  const token = req.cookies?.[authConfig.sessionCookieName];
  if (typeof token !== "string" || token.length < 20) return null;

  const sessionId = sha256(token);
  const nowIso = new Date().toISOString();
  const row = await db
    .select({
      expiresAt: schema.sessions.expiresAt,
      lastSeenAt: schema.sessions.lastSeenAt,
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      avatarUrl: schema.users.avatarUrl,
      termsAcceptedAt: schema.users.termsAcceptedAt,
      totpEnabledAt: schema.users.totpEnabledAt,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sessionId), gt(schema.sessions.expiresAt, nowIso)))
    .get();

  if (!row) {
    res.clearCookie(authConfig.sessionCookieName, { path: "/" });
    return null;
  }

  const ttl = authConfig.sessionTtlDays * DAY_MS;
  const remaining = new Date(row.expiresAt).getTime() - Date.now();
  if (remaining < ttl / 2) {
    const expiresAt = new Date(Date.now() + ttl).toISOString();
    await db.update(schema.sessions).set({ expiresAt, lastSeenAt: nowIso }).where(eq(schema.sessions.id, sessionId)).run();
    res.cookie(authConfig.sessionCookieName, token, cookieOptions(ttl));
  } else if (Date.now() - new Date(row.lastSeenAt).getTime() > 10 * 60 * 1000) {
    // Keep "last active" in the device list roughly current without a write per request.
    await db.update(schema.sessions).set({ lastSeenAt: nowIso }).where(eq(schema.sessions.id, sessionId)).run();
  }

  const { expiresAt: _e, lastSeenAt: _l, termsAcceptedAt, totpEnabledAt, ...rest } = row;
  return { sessionId, user: { ...rest, needsProfile: !termsAcceptedAt, mfaEnabled: !!totpEnabledAt } };
}

export async function destroySession(res: Response, sessionId: string | undefined): Promise<void> {
  if (sessionId) await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run();
  res.clearCookie(authConfig.sessionCookieName, { path: "/" });
}

export async function purgeExpired(): Promise<void> {
  const nowIso = new Date().toISOString();
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, nowIso)).run();
  await db.delete(schema.emailOtps).where(lt(schema.emailOtps.expiresAt, new Date(Date.now() - DAY_MS).toISOString())).run();
  await db.delete(schema.mfaChallenges).where(lt(schema.mfaChallenges.expiresAt, nowIso)).run();
}

export async function listSessions(userId: string, currentSessionId: string | undefined) {
  const rows = await db
    .select()
    .from(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), gt(schema.sessions.expiresAt, new Date().toISOString())))
    .all();
  return rows
    .map((r) => ({
      id: r.publicId,
      current: r.id === currentSessionId,
      userAgent: r.userAgent,
      ip: r.ip,
      createdAt: r.createdAt,
      lastSeenAt: r.lastSeenAt,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current) || b.lastSeenAt.localeCompare(a.lastSeenAt));
}

export async function revokeSession(userId: string, publicId: string): Promise<void> {
  await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, userId), eq(schema.sessions.publicId, publicId))).run();
}

export async function revokeOtherSessions(userId: string, currentSessionId: string | undefined): Promise<number> {
  const rows = await db.select({ id: schema.sessions.id }).from(schema.sessions).where(eq(schema.sessions.userId, userId)).all();
  const others = rows.filter((r) => r.id !== currentSessionId);
  for (const r of others) await db.delete(schema.sessions).where(eq(schema.sessions.id, r.id)).run();
  return others.length;
}
