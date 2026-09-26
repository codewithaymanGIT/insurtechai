import crypto from "crypto";
import fs from "fs";
import path from "path";

export const isProduction = process.env.NODE_ENV === "production";

function readSecret(): string {
  const s = process.env.AUTH_SECRET?.trim();
  if (s && s.length >= 32) return s;
  if (isProduction) {
    throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters in production.");
  }
  // Local development without AUTH_SECRET: generate one once and keep it in
  // backend/.auth-secret (gitignored), so sign-in codes and encrypted 2FA
  // secrets keep working across restarts.
  const file = path.resolve(__dirname, "..", "..", ".auth-secret");
  try {
    const existing = fs.readFileSync(file, "utf8").trim();
    if (existing.length >= 32) return existing;
  } catch {
    /* not created yet */
  }
  const generated = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(file, generated, { mode: 0o600 });
  console.warn(`[auth] AUTH_SECRET is not set; generated a local one in ${file}. Set AUTH_SECRET in production.`);
  return generated;
}

export const authConfig = {
  secret: readSecret(),

  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || null,

  smtp: process.env.SMTP_HOST?.trim()
    ? {
        host: process.env.SMTP_HOST.trim(),
        port: Number(process.env.SMTP_PORT ?? 587),
        user: process.env.SMTP_USER?.trim() ?? "",
        pass: process.env.SMTP_PASS?.trim() ?? "",
        from: process.env.EMAIL_FROM?.trim() || process.env.SMTP_USER?.trim() || "",
      }
    : null,

  adminEmails: new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  ),

  sessionCookieName: isProduction ? "__Host-itai_session" : "itai_session",
  sessionTtlDays: 30,
  otpTtlMinutes: 10,
  otpMaxAttempts: 5,
  otpResendSeconds: 60,
  otpMaxPerHour: 5,

  chatDailyLimit: Number(process.env.CHAT_DAILY_LIMIT ?? 40),

  /** Origins allowed to make state-changing requests (CSRF defence in depth on top of SameSite=Lax). */
  allowedOrigins: new Set(
    (process.env.APP_ORIGIN ?? process.env.CORS_ORIGIN ?? "http://localhost:5173")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  ),
};
