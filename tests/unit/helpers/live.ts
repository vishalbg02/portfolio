import { vi } from "vitest";
import { TokenBucketLimiter } from "@/lib/rate-limit/bucket";
import type { MemoryLiveStore } from "@/lib/live/store";

/** Every variable the live chat needs, with fake values (nothing here is ever sent anywhere). */
export const LIVE_ENV = {
  TELEGRAM_BOT_TOKEN: "123:TESTTOKEN",
  TELEGRAM_CHAT_ID: "4242",
  TELEGRAM_WEBHOOK_SECRET: "hook-secret",
  LIVE_CHAT_SIGNING_SECRET: "signing-secret-for-tests",
  CRON_SECRET: "cron-secret",
  UPSTASH_REDIS_REST_URL: "https://fake.upstash.invalid",
  UPSTASH_REDIS_REST_TOKEN: "fake",
} as const;

export type Sent = { text: string; replyTo?: number; messageId: number };

/** Loads the live chat with in-memory stand-ins for Redis, Telegram and email. */
export async function loadLive(
  opts: { env?: Record<string, string>; telegramOk?: boolean; sender?: boolean } = {},
) {
  vi.resetModules();
  for (const [k, v] of Object.entries({ ...LIVE_ENV, ...(opts.env ?? {}) })) vi.stubEnv(k, v);
  if (opts.sender !== false) {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("CONTACT_TO_EMAIL", "owner@example.com");
    vi.stubEnv("CONTACT_FROM_EMAIL", "Vishal <hello@verified.example>");
  } else {
    for (const k of ["RESEND_API_KEY", "CONTACT_TO_EMAIL", "CONTACT_FROM_EMAIL"]) vi.stubEnv(k, "");
  }

  // limiters and once-only guards, in memory (the real ones talk to Upstash when it is configured)
  const buckets = new Map<string, TokenBucketLimiter>();
  vi.doMock("@/lib/rate-limit", async (orig) => {
    const real = await orig<typeof import("@/lib/rate-limit")>();
    return {
      ...real,
      rateLimit: async (o: { scope: string; limit: number; windowSec: number }, key: string) => {
        const id = `${o.scope}:${o.limit}:${o.windowSec}`;
        let b = buckets.get(id);
        if (!b) buckets.set(id, (b = new TokenBucketLimiter(o.limit, o.windowSec * 1000)));
        return b.take(key);
      },
    };
  });
  const claimed = new Set<string>();
  const caps = new Map<string, number>();
  vi.doMock("@/lib/notify/once", () => ({
    claimOnce: async (k: string) => (claimed.has(k) ? false : (claimed.add(k), true)),
    releaseClaim: async (k: string) => void claimed.delete(k),
    underDailyCap: async (scope: string, limit: number) => {
      const n = (caps.get(scope) ?? 0) + 1;
      caps.set(scope, n);
      return n <= limit;
    },
    resetOnce: () => {},
  }));

  // Telegram's HTTP API: records what Vishal would see and hands back message ids
  const telegram: Sent[] = [];
  let nextId = 1000;
  const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("api.telegram.org") && u.endsWith("/sendMessage")) {
      if (opts.telegramOk === false) return new Response("{}", { status: 500 });
      const body = JSON.parse(String(init?.body));
      const messageId = nextId++;
      telegram.push({ text: body.text, replyTo: body.reply_parameters?.message_id, messageId });
      return new Response(JSON.stringify({ ok: true, result: { message_id: messageId } }), { status: 200 });
    }
    if (u.includes("challenges.cloudflare.com"))
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    throw new Error(`unexpected fetch: ${u}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  const emails: Array<{ to: string | null; text: string }> = [];
  vi.doMock("@/lib/email/send", () => ({
    FROM: "x",
    sendOwnerEmail: vi.fn(async () => undefined),
    sendReplyEmail: vi.fn(async (conv: { email: string | null }, text: string) => {
      emails.push({ to: conv.email, text });
    }),
  }));

  const { MemoryLiveStore, setLiveStoreForTests } = await import("@/lib/live/store");
  const store: MemoryLiveStore = new MemoryLiveStore();
  setLiveStoreForTests(store);
  return { store, telegram, emails, fetchMock };
}
