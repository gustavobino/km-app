import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: [
      "lib/**/*.test.ts",
      "db/**/*.test.ts",
      "components/**/*.test.{ts,tsx}",
    ],
    environment: "node",
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      exclude: ["lib/**/*.test.ts", "lib/supabase/**"],
      thresholds: {
        // CLAUDE.md: 100% of the pure calculation modules.
        "lib/metrics/**": {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
        "lib/simulator/**": {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
        "lib/insights/**": {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
      },
    },
  },
});
