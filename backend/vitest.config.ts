import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    // Each file gets its own temporary SQLite database (see setup.ts).
    pool: "forks",
    testTimeout: 20000,
  },
});
