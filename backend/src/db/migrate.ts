import { migrate } from "drizzle-orm/libsql/migrator";
import { db, client } from "./client";
import path from "path";

async function main() {
  await migrate(db, { migrationsFolder: path.join(__dirname, "..", "..", "drizzle") });
  console.log("Migrations applied.");
  client.close();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
