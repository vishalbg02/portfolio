import "server-only";
import { z } from "zod";

/**
 * Server environment. Every variable is optional: the site must build and run with none set,
 * and each feature degrades gracefully when its variable is missing.
 */
const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const ServerEnvSchema = z.object({
  GEMINI_API_KEY: optional,
  GROQ_API_KEY: optional,
  TELEGRAM_BOT_TOKEN: optional,
  TELEGRAM_CHAT_ID: optional,
  TELEGRAM_WEBHOOK_SECRET: optional,
  LIVE_CHAT_SIGNING_SECRET: optional,
  CRON_SECRET: optional,
  TURNSTILE_SECRET_KEY: optional,
  GITHUB_TOKEN: optional,
  RESEND_API_KEY: optional,
  CONTACT_TO_EMAIL: z.email().optional().catch(undefined),
  UPSTASH_REDIS_REST_URL: optional,
  UPSTASH_REDIS_REST_TOKEN: optional,
  AI_DAILY_LIMIT: z.coerce.number().int().positive().max(100_000).optional().catch(undefined),
  SHOW_RECOGNITION: z
    .enum(["true", "false"])
    .optional()
    .catch(undefined)
    .transform((v) => v !== "false"),
});

export const env = ServerEnvSchema.parse({
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
  LIVE_CHAT_SIGNING_SECRET: process.env.LIVE_CHAT_SIGNING_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  CONTACT_TO_EMAIL: process.env.CONTACT_TO_EMAIL || undefined,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  AI_DAILY_LIMIT: process.env.AI_DAILY_LIMIT,
  SHOW_RECOGNITION: process.env.SHOW_RECOGNITION,
});

export const features = {
  ai: Boolean(env.GEMINI_API_KEY || env.GROQ_API_KEY),
  github: Boolean(env.GITHUB_TOKEN),
  email: Boolean(env.RESEND_API_KEY && env.CONTACT_TO_EMAIL),
  telegram: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
  /** Live chat needs somewhere to keep threads, a way to reach Vishal, a secret to sign links, and the webhook secret. */
  live: Boolean(
    env.TELEGRAM_BOT_TOKEN &&
    env.TELEGRAM_CHAT_ID &&
    env.TELEGRAM_WEBHOOK_SECRET &&
    env.LIVE_CHAT_SIGNING_SECRET &&
    env.UPSTASH_REDIS_REST_URL &&
    env.UPSTASH_REDIS_REST_TOKEN,
  ),
  turnstile: Boolean(env.TURNSTILE_SECRET_KEY),
  upstash: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
  recognition: env.SHOW_RECOGNITION,
} as const;
