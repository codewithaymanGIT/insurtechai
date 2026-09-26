import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, newRecoveryCodes, newTotpSecret, normalizeRecoveryCode, verifyTotp } from "../src/auth/totp";

// RFC 6238 Appendix B, SHA-1 key "12345678901234567890" (base32 below); the
// RFC lists 8-digit codes, and a 6-digit code is their last six digits.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const VECTORS: [number, string][] = [
  [59, "94287082"], [1111111109, "07081804"], [1111111111, "14050471"], [1234567890, "89005924"], [2000000000, "69279037"],
];

describe("TOTP (RFC 6238)", () => {
  it.each(VECTORS)("matches the RFC vector at t=%s", (t, code8) => {
    expect(verifyTotp(RFC_SECRET, code8.slice(2), null, t * 1000)).toBe(Math.floor(t / 30));
  });

  it("accepts one step of clock drift either side, not two", () => {
    const [t, code8] = VECTORS[3];
    const code = code8.slice(2);
    expect(verifyTotp(RFC_SECRET, code, null, (t + 30) * 1000)).not.toBeNull();
    expect(verifyTotp(RFC_SECRET, code, null, (t - 30) * 1000)).not.toBeNull();
    expect(verifyTotp(RFC_SECRET, code, null, (t + 60) * 1000)).toBeNull();
  });

  it("refuses a code from a step that was already used", () => {
    const [t, code8] = VECTORS[3];
    const step = verifyTotp(RFC_SECRET, code8.slice(2), null, t * 1000)!;
    expect(verifyTotp(RFC_SECRET, code8.slice(2), step, t * 1000)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifyTotp(RFC_SECRET, "12345", null)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "abcdef", null)).toBeNull();
  });

  it("generates 160-bit secrets", () => {
    expect(newTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });
});

describe("secret storage", () => {
  it("round-trips through AES-GCM and never stores the plain secret", () => {
    const s = newTotpSecret();
    const enc = encryptSecret(s);
    expect(enc).not.toContain(s);
    expect(decryptSecret(enc)).toBe(s);
  });

  it("detects tampering", () => {
    const [iv, tag, ct] = encryptSecret(newTotpSecret()).split(".");
    const flipped = Buffer.from(ct, "base64");
    flipped[0] ^= 1;
    expect(() => decryptSecret([iv, tag, flipped.toString("base64")].join("."))).toThrow();
  });

  it("uses a fresh IV every time", () => {
    const s = newTotpSecret();
    expect(encryptSecret(s)).not.toBe(encryptSecret(s));
  });
});

describe("recovery codes", () => {
  it("issues 10 distinct codes", () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
  });

  it("normalises spacing, case and dashes", () => {
    const [c] = newRecoveryCodes();
    expect(normalizeRecoveryCode(` ${c.toUpperCase().replace(/-/g, " ")} `)).toBe(normalizeRecoveryCode(c));
  });
});

