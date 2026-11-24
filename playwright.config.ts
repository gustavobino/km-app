import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3200);
/** Run against a deployed site (no local server): E2E_BASE_URL=https://… */
const REMOTE = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  // The suite signs in against the real Supabase; under load a redirect can take > 5 s.
  expect: { timeout: 10_000 },
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: REMOTE ?? `http://localhost:${PORT}`,
    trace: "off",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    // Optional: point to a preinstalled Chromium (e.g. in cloud containers).
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
  webServer: REMOTE
    ? undefined
    : {
        command: `pnpm build && pnpm start --port ${PORT}`,
        env: {
          ...(process.env as Record<string, string>),
          NEXT_TELEMETRY_DISABLED: "1",
      // Same as production: login by 6-digit code (needs custom SMTP templates).
      NEXT_PUBLIC_AUTH_OTP_CODE: "true",
          // Test-only values; real ones live in Vercel's environment.
          MERCADOPAGO_WEBHOOK_SECRET:
            process.env.E2E_WEBHOOK_SECRET ?? "e2e-webhook-secret",
          ADMIN_EMAILS: process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@example.com",
        },
        url: `http://localhost:${PORT}/registrar`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
