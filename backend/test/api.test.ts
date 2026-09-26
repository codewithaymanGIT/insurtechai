import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../src/app";
import { health, motor } from "./fixtures";
import { totpNow } from "./helpers";

const ORIGIN = "http://localhost:5173";

/** A browser session: keeps cookies and sends the Origin header like a real page. */
function browser() {
  const agent = request.agent(app);
  return {
    get: (url: string) => agent.get(url).set("Origin", ORIGIN),
    post: (url: string, body?: object) => agent.post(url).set("Origin", ORIGIN).send(body ?? {}),
  };
}

// Email codes have a 60-second resend cooldown, so the clock is moved on
// between sign-ins. Only Date is faked; timers and I/O run normally.
beforeAll(() => vi.useFakeTimers({ toFake: ["Date"], now: Date.now() }));
afterAll(() => vi.useRealTimers());
const later = () => vi.setSystemTime(Date.now() + 61_000);

/** Requests an email code and reads it from the dev-mode console output. */
async function emailCode(b: ReturnType<typeof browser>, email: string) {
  later();
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  await b.post("/api/auth/email/request", { email }).expect(200);
  const line = log.mock.calls.map((c) => String(c[0])).find((l) => l.includes(`Sign-in code for ${email}`));
  log.mockRestore();
  return line!.match(/(\d{6})/)![1];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("estimates", () => {
  it("prices a motor profile without an account and doesn't save it", async () => {
    const res = await browser().post("/api/risk-assessment", motor()).expect(201);
    expect(res.body.premium.finalPremium).toBeGreaterThan(0);
    expect(res.body.motorValue.idv).toBe(700000);
    expect(res.body.savedId).toBeNull();
  });

  it("returns field-level errors for invalid answers", async () => {
    const bad = motor({ engineCapacityCC: -5 });
    const res = await browser().post("/api/risk-assessment", bad).expect(400);
    expect(JSON.stringify(res.body)).toContain("engineCapacityCC");
  });

  it("writes engine text in the requested language", async () => {
    const en = await browser().post("/api/risk-assessment", health());
    const hi = await request(app).post("/api/risk-assessment").set("Origin", ORIGIN).set("X-Lang", "hi").send(health());
    expect(en.body.decisionSummary.verdict).toMatch(/^[\x00-\x7F₹–]+$/);
    expect(hi.body.decisionSummary.verdict).toMatch(/[ऀ-ॿ]/);
    expect(hi.body.premium.finalPremium).toBe(en.body.premium.finalPremium);
  });
});

describe("security basics", () => {
  it("rejects state-changing requests from another origin", async () => {
    await request(app).post("/api/risk-assessment").set("Origin", "https://evil.example").send(motor()).expect(403);
  });

  it("keeps account routes behind sign-in", async () => {
    await browser().get("/api/me/security").expect(401);
    await browser().get("/api/dashboard").expect(401);
  });

  it("rejects a wrong email code", async () => {
    const b = browser();
    await emailCode(b, "wrong@example.com");
    await b.post("/api/auth/email/verify", { email: "wrong@example.com", code: "000000" }).expect(400);
  });
});

describe("sign-up and two-step verification", () => {
  it("runs the whole flow", async () => {
    const email = "flow@example.com";
    const b = browser();

    // New account: signed in, but must accept the terms first.
    let res = await b.post("/api/auth/email/verify", { email, code: await emailCode(b, email) }).expect(200);
    expect(res.body.status).toBe("profile");
    await b.post("/api/me/profile", { name: "Test User" }).expect(400);
    await b.post("/api/me/profile", { name: "Test User", acceptTerms: true }).expect(200);

    // Turn on 2FA.
    res = await b.post("/api/me/2fa/setup").expect(200);
    const secret: string = res.body.secret;
    await b.post("/api/me/2fa/enable", { code: "000000" }).expect(400);
    res = await b.post("/api/me/2fa/enable", { code: totpNow(secret) }).expect(200);
    const recovery: string[] = res.body.recoveryCodes;
    expect(recovery).toHaveLength(10);

    // Sign in again from a new browser: the email code alone isn't enough.
    const b2 = browser();
    res = await b2.post("/api/auth/email/verify", { email, code: await emailCode(b2, email) }).expect(200);
    expect(res.body.status).toBe("mfa");
    expect((await b2.get("/api/auth/me")).body.user).toBeNull();

    // A wrong authenticator code fails; the current one works. (Replay
    // protection within a 30-second step is covered in totp.test.ts.)
    await b2.post("/api/auth/mfa", { code: "123456" === totpNow(secret) ? "654321" : "123456" }).expect(400);
    await b2.post("/api/auth/mfa", { code: totpNow(secret) }).expect(200);
    expect((await b2.get("/api/auth/me")).body.user.mfaEnabled).toBe(true);

    // A recovery code works once.
    const b3 = browser();
    await b3.post("/api/auth/email/verify", { email, code: await emailCode(b3, email) }).expect(200);
    await b3.post("/api/auth/mfa", { recoveryCode: recovery[0] }).expect(200);
    const b4 = browser();
    await b4.post("/api/auth/email/verify", { email, code: await emailCode(b4, email) }).expect(200);
    await b4.post("/api/auth/mfa", { recoveryCode: recovery[0] }).expect(400);

    // Devices: sign out every other session from the first browser.
    res = await b.get("/api/me/security").expect(200);
    expect(res.body.sessions.length).toBeGreaterThanOrEqual(3);
    await b.post("/api/me/sessions/revoke-others").expect(200);
    expect((await b2.get("/api/auth/me")).body.user).toBeNull();
    expect((await b.get("/api/auth/me")).body.user.email).toBe(email);
  });
});
