import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import path from "path";
import * as schema from "./schema";

// @libsql/client ships precompiled native bindings (no node-gyp/C++ compiler
// required on any platform, including Windows) while remaining fully
// SQLite-file-compatible with the existing drizzle migrations below. This
// replaced better-sqlite3 specifically to avoid the Windows Visual
// Studio Build Tools toolchain requirement for local/demo setup.
const url = process.env.DATABASE_URL ?? "file:./dev.db";
const isRemote = /^(libsql|https?|wss?):\/\//.test(url);
const dbPath = url.replace("file:", "");
const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);

// Local SQLite file by default; a hosted libSQL database (e.g. Turso) when
// DATABASE_URL is a libsql:// or https:// URL, with DATABASE_AUTH_TOKEN.
export const client = isRemote
  ? createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN })
  : createClient({ url: `file:${resolvedPath}` });

// Fire-and-forget: these resolve well before the first HTTP request can
// possibly arrive (no top-level await here, since the backend still
// compiles to CommonJS for `npm run build` / `tsc`, which doesn't support it).
if (!isRemote) client.execute("PRAGMA journal_mode = WAL").catch((err) => console.error("Failed to set journal_mode:", err));
client.execute("PRAGMA foreign_keys = ON").catch((err) => console.error("Failed to set foreign_keys:", err));

export const db = drizzle(client, { schema });
