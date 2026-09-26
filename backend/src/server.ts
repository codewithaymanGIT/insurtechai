import "dotenv/config";
import { app } from "./app";
import { authConfig, isProduction } from "./auth/config";
import { purgeExpired } from "./auth/sessions";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

async function main() {
  await purgeExpired();
  setInterval(() => purgeExpired().catch((e) => console.error("[auth] purge failed:", e)), 6 * 60 * 60 * 1000).unref();
  app.listen(PORT, () => {
    console.log(`InsurTechAI backend listening on http://localhost:${PORT}`);
    if (!authConfig.googleClientId) console.log("[auth] Google sign-in disabled: GOOGLE_CLIENT_ID not set.");
    if (!authConfig.smtp) console.log(`[auth] Email codes ${isProduction ? "DISABLED (set SMTP_*)" : "will print in this terminal (SMTP not configured)"}.`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
