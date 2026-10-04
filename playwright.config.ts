import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * e2e + a11y run against a production build (`pnpm build` first).
 * Visual regression (tests/visual) runs only on Linux CI inside the Playwright Docker image
 * so font rendering is deterministic — never generate baselines on macOS.
 */
const runVisual = process.env.VISUAL === "1" && process.platform === "linux";

export default defineConfig({
  testDir: "tests",
  testMatch: runVisual ? ["visual/**/*.spec.ts"] : ["e2e/**/*.spec.ts"],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    reducedMotion: runVisual ? "reduce" : "no-preference",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm start --port ${PORT}`,
        url: baseURL,
        // A stray server (maybe started with real keys) must not be reused: e2e must never hit paid APIs.
        reuseExistingServer: false,
        timeout: 60_000,
        // Hermetic: blank keys override anything in .env.local, so AI/email/GitHub run in their offline modes.
        env: {
          GEMINI_API_KEY: "",
          GROQ_API_KEY: "",
          TELEGRAM_BOT_TOKEN: "",
          TELEGRAM_CHAT_ID: "",
          TELEGRAM_WEBHOOK_SECRET: "",
          LIVE_CHAT_SIGNING_SECRET: "",
          CRON_SECRET: "",
          RESEND_API_KEY: "",
          GITHUB_TOKEN: "",
          UPSTASH_REDIS_REST_URL: "",
          UPSTASH_REDIS_REST_TOKEN: "",
        },
      },
});
