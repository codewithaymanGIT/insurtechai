import nodemailer, { type Transporter } from "nodemailer";
import { authConfig, isProduction } from "./config";
import { tr } from "../i18n";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!authConfig.smtp) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: authConfig.smtp.host,
      port: authConfig.smtp.port,
      secure: authConfig.smtp.port === 465,
      auth: authConfig.smtp.user ? { user: authConfig.smtp.user, pass: authConfig.smtp.pass } : undefined,
    });
  }
  return transporter;
}

export function emailDeliveryMode(): "smtp" | "console" | "unavailable" {
  if (authConfig.smtp) return "smtp";
  return isProduction ? "unavailable" : "console";
}

export async function sendSignInCode(to: string, code: string): Promise<void> {
  const t = getTransporter();
  const minutes = authConfig.otpTtlMinutes;

  if (!t) {
    if (isProduction) throw new Error("SMTP is not configured.");
    // Local development without SMTP: print the code so sign-in can still be tested.
    console.log(`\n[auth] Sign-in code for ${to}: ${code}  (expires in ${minutes} min; set SMTP_* in backend/.env to send real emails)\n`);
    return;
  }

  await t.sendMail({
    from: `InsurTechAI <${authConfig.smtp!.from}>`,
    to,
    subject: tr("{code} is your InsurTechAI sign-in code", { code }),
    text: [
      tr("Your sign-in code is {code}.", { code }),
      "",
      tr("It expires in {minutes} minutes and can only be used once.", { minutes }),
      tr("If you didn't try to sign in, you can ignore this email. Nobody can sign in without this code."),
    ].join("\n"),
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:420px;margin:0 auto;padding:32px 24px;color:#111">
        <p style="font-size:14px;margin:0 0 24px;color:#555">InsurTechAI</p>
        <p style="font-size:15px;margin:0 0 12px">${tr("Your sign-in code:")}</p>
        <p style="font-size:32px;letter-spacing:6px;font-weight:600;margin:0 0 24px;font-family:ui-monospace,Menlo,monospace">${code}</p>
        <p style="font-size:13px;line-height:1.5;color:#555;margin:0">${tr("It expires in {minutes} minutes and can only be used once. If you didn't try to sign in, ignore this email. Nobody can sign in without this code.", { minutes })}</p>
      </div>`,
  });
}
