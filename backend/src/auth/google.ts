import { OAuth2Client } from "google-auth-library";
import { authConfig } from "./config";
import { ApiError } from "../api/middleware/errorHandler";
import { tr } from "../i18n";

let client: OAuth2Client | null = null;

/** Verifies an ID token from Google Identity Services ("Sign in with
 * Google" button): signature against Google's published keys, audience
 * (our client ID), issuer and expiry. */
export async function verifyGoogleCredential(credential: string) {
  if (!authConfig.googleClientId) throw new ApiError(503, tr("Google sign-in isn't configured on this server."));
  client ??= new OAuth2Client(authConfig.googleClientId);

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: authConfig.googleClientId });
    payload = ticket.getPayload();
  } catch (err) {
    console.error("[auth] Google token verification failed:", err instanceof Error ? err.message : err);
    throw new ApiError(401, tr("Google sign-in failed. Please try again."));
  }

  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new ApiError(401, tr("Your Google account's email address isn't verified."));
  }

  return {
    googleSub: payload.sub,
    email: payload.email,
    name: payload.name ?? null,
    avatarUrl: payload.picture ?? null,
  };
}
