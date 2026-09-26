// Runs before each test file: a throwaway database and fixed secrets, set
// before any app module reads process.env.
import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "itai-test-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
process.env.AUTH_SECRET = "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz";
process.env.APP_ORIGIN = "http://localhost:5173";
delete process.env.SMTP_HOST;
delete process.env.GEMINI_API_KEY;
delete process.env.GOOGLE_CLIENT_ID;

beforeAll(async () => {
  const { migrate } = await import("drizzle-orm/libsql/migrator");
  const { db } = await import("../src/db/client");
  await migrate(db, { migrationsFolder: path.join(__dirname, "..", "drizzle") });
});

afterAll(async () => {
  const { client } = await import("../src/db/client");
  client.close();
  try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* Windows can hold the SQLite file briefly; the OS clears temp */ }
});


