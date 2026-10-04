import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/unit/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    environment: "node",
    // Hermetic: tests never call paid or external services, whatever is in the developer's shell.
    env: {
      GEMINI_API_KEY: "",
      GROQ_API_KEY: "",
      TELEGRAM_BOT_TOKEN: "",
      TELEGRAM_CHAT_ID: "",
      TELEGRAM_WEBHOOK_SECRET: "",
      LIVE_CHAT_SIGNING_SECRET: "",
      CRON_SECRET: "",
      GITHUB_TOKEN: "",
      RESEND_API_KEY: "",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      AI_DAILY_LIMIT: "",
    },
  },
});
