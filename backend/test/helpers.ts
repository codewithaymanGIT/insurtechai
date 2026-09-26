import crypto from "crypto";

/** An authenticator app: the current (or offset) 6-digit code for a base32 secret. */
export function totpNow(base32: string, offsetSteps = 0): string {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, v = 0;
  const bytes: number[] = [];
  for (const ch of base32) {
    v = (v << 5) | A.indexOf(ch);
    bits += 5;
    if (bits >= 8) { bytes.push((v >>> (bits - 8)) & 255); bits -= 8; }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offsetSteps));
  const h = crypto.createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const o = h[h.length - 1] & 15;
  return ((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).toString().padStart(6, "0");
}
