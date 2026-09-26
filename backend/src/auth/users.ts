import { eq } from "drizzle-orm";
import { db } from "../db/client";
import * as schema from "../db/schema";
import { authConfig } from "./config";
import { normalizeEmail } from "./tokens";
import { ApiError } from "../api/middleware/errorHandler";
import { tr } from "../i18n";

interface VerifiedIdentity {
  email: string;
  name?: string | null;
  googleSub?: string | null;
  avatarUrl?: string | null;
}

function defaultName(email: string): string {
  const local = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  return local ? local.replace(/\b\w/g, (c) => c.toUpperCase()) : email;
}

/** Finds or creates the user for an identity whose email has already been
 * verified (by Google, or by a correct one-time code). Role is kept in
 * sync with ADMIN_EMAILS on every sign-in. */
export async function upsertVerifiedUser(identity: VerifiedIdentity): Promise<string> {
  const email = normalizeEmail(identity.email);
  const role = authConfig.adminEmails.has(email) ? "ADMIN" : "USER";
  const nowIso = new Date().toISOString();

  let existing = identity.googleSub
    ? await db.select().from(schema.users).where(eq(schema.users.googleSub, identity.googleSub)).get()
    : undefined;
  if (!existing) existing = await db.select().from(schema.users).where(eq(schema.users.email, email)).get();

  if (existing) {
    if (identity.googleSub && existing.googleSub && existing.googleSub !== identity.googleSub) {
      throw new ApiError(409, tr("This email is already linked to a different Google account."));
    }
    await db
      .update(schema.users)
      .set({
        role,
        googleSub: existing.googleSub ?? identity.googleSub ?? null,
        avatarUrl: identity.avatarUrl ?? existing.avatarUrl,
        name: existing.name || identity.name || defaultName(email),
        emailVerifiedAt: existing.emailVerifiedAt ?? nowIso,
      })
      .where(eq(schema.users.id, existing.id))
      .run();
    return existing.id;
  }

  const created = await db
    .insert(schema.users)
    .values({
      email,
      name: identity.name?.trim() || defaultName(email),
      role,
      googleSub: identity.googleSub ?? null,
      avatarUrl: identity.avatarUrl ?? null,
      emailVerifiedAt: nowIso,
    })
    .returning({ id: schema.users.id })
    .get();
  return created.id;
}
