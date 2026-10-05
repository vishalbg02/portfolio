import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { post } from "./helpers/ai";

const GOOD = {
  name: "Asha Rao",
  email: "asha@example.com",
  message: "Hello Vishal, we'd like to talk about a backend role at our company.",
};
const id = () => crypto.randomUUID();

const sendEmail = vi.fn<(...args: unknown[]) => Promise<void>>();
const telegramFetch = vi.fn<(...args: unknown[]) => Promise<Response>>();

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  sendEmail.mockClear().mockImplementation(async () => undefined);
  telegramFetch.mockClear().mockImplementation(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", telegramFetch);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.doUnmock("@/lib/email/send");
});

const CHANNELS = {
  both: {
    TELEGRAM_BOT_TOKEN: "123:ABC",
    TELEGRAM_CHAT_ID: "42",
    RESEND_API_KEY: "re_x",
    CONTACT_TO_EMAIL: "me@example.com",
  },
  telegram: { TELEGRAM_BOT_TOKEN: "123:ABC", TELEGRAM_CHAT_ID: "42" },
  email: { RESEND_API_KEY: "re_x", CONTACT_TO_EMAIL: "me@example.com" },
  none: {},
} as const;

async function load(channels: keyof typeof CHANNELS = "both") {
  vi.resetModules();
  vi.doMock("@/lib/email/send", () => ({ sendOwnerEmail: sendEmail, FROM: "x" }));
  for (const [k, v] of Object.entries(CHANNELS[channels])) vi.stubEnv(k, v);
  const route = await import("@/app/api/grid/message/route");
  const once = await import("@/lib/notify/once");
  return { route, once };
}
const send = (body: unknown, ip = "9.9.9.9", headers: Record<string, string> = {}) =>
  post("/api/grid/message", typeof body === "string" ? body : { requestId: id(), ...(body as object) }, {
    "x-forwarded-for": ip,
    ...headers,
  });

describe("message rules (browser and server agree)", () => {
  it("the same inputs pass or fail in the browser check and in the Zod schema", async () => {
    const { validateMessage } = await import("@/lib/notify/message");
    const { GridMessageSchema } = await import("@/lib/notify/schema");
    const cases = [
      GOOD,
      { ...GOOD, name: "A" },
      { ...GOOD, name: "N".repeat(81) },
      { ...GOOD, email: "not-an-email" },
      { ...GOOD, message: "short" },
      { ...GOOD, message: "m".repeat(1501) },
      { ...GOOD, message: "m".repeat(1500) },
      { ...GOOD, message: "see https://a.io and https://b.io and https://c.io" },
      { ...GOOD, message: "see https://a.io and https://b.io only, thanks!" },
    ];
    for (const c of cases) {
      const browser = validateMessage(c).ok;
      const server = GridMessageSchema.safeParse({ ...c, requestId: id() }).success;
      expect(server, JSON.stringify(c).slice(0, 80)).toBe(browser);
    }
  });

  it("counts links with or without a scheme, but not an email address", async () => {
    const { countLinks } = await import("@/lib/notify/message");
    expect(countLinks("no links here, mail me at asha@example.com")).toBe(0);
    expect(countLinks("https://a.io and www.b.com and c.dev/path")).toBe(3);
    expect(countLinks("visit example.com/x")).toBe(1);
  });

  it("cleans control characters and keeps paragraphs", async () => {
    const { cleanText, oneLine } = await import("@/lib/notify/message");
    expect(cleanText("a\u0000b\r\n\r\n\r\n\r\nc  \n d")).toBe("ab\n\nc\n d");
    expect(oneLine("Asha\nRao\t\u0007  X")).toBe("Asha Rao X");
  });
});

describe("what lands on Vishal's phone", () => {
  it("escapes everything a visitor typed, so nothing becomes Telegram markup", async () => {
    const { ownerPing, escapeHtml } = await import("@/lib/notify/telegram");
    expect(escapeHtml("<b>x</b> & <script>")).toBe("&lt;b&gt;x&lt;/b&gt; &amp; &lt;script&gt;");
    const text = ownerPing({
      name: "<i>Asha</i>",
      email: "a@b.co",
      message: 'Click <a href="x">here</a> & win',
    });
    expect(text).not.toMatch(/<i>|<a |<script/);
    expect(text).toContain("&lt;i&gt;Asha&lt;/i&gt;");
    expect(text).toContain("<b>New message via GRID</b>"); // our own header is the only markup
    expect(text.length).toBeLessThan(4096);
  });

  it("shows the company and role from the card, escaped, on an About line", async () => {
    const { ownerPing, orgOf } = await import("@/lib/notify/telegram");
    expect(orgOf("Acme", "Backend Engineer")).toBe("Backend Engineer role · Acme");
    expect(orgOf("", "")).toBeNull();
    const text = ownerPing({
      name: "Priya",
      email: "p@acme.dev",
      message: "Hello there!",
      org: orgOf("<b>Acme</b>", ""),
    });
    expect(text).toContain("<b>About:</b> &lt;b&gt;Acme&lt;/b&gt;");
    expect(ownerPing({ name: "Priya", email: "p@acme.dev", message: "Hello there!" })).not.toContain(
      "About:",
    );
  });

  it("the route accepts the optional company and role (and refuses one that is too long)", async () => {
    const { route } = await load("telegram");
    const ok = await route.POST(
      send({ ...GOOD, requestId: crypto.randomUUID(), company: "Acme", role: "SDE" }),
    );
    expect(ok.status).toBe(200);
    const long = await route.POST(send({ ...GOOD, requestId: crypto.randomUUID(), company: "x".repeat(81) }));
    expect(long.status).toBe(400);
  });

  it("posts to Telegram with the chat id, HTML mode and no link preview, and never leaks the token", async () => {
    const { route } = await load("telegram");
    const res = await route.POST(send(GOOD));
    expect(res.status).toBe(200);
    const [url, init] = telegramFetch.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123:ABC/sendMessage");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      chat_id: "42",
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
    expect(body.text).toContain("Asha Rao");
    // nothing logged contains the token or the visitor's words
    const logged = JSON.stringify([
      ...(console.info as ReturnType<typeof vi.fn>).mock.calls,
      ...(console.error as ReturnType<typeof vi.fn>).mock.calls,
    ]);
    expect(logged).not.toContain("123:ABC");
    expect(logged).not.toContain("backend role");
  });
});

describe("POST /api/grid/message", () => {
  it("delivers on every configured channel", async () => {
    const { route } = await load("both");
    const res = await route.POST(send(GOOD, "1.0.0.1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(telegramFetch).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [sub, source] = sendEmail.mock.calls[0]! as [
      { name: string; email: string; message: string },
      string,
    ];
    expect(sub).toMatchObject({ name: "Asha Rao", email: "asha@example.com" });
    expect(source).toMatch(/GRID/);
  });

  it("is delivered if at least one channel took it", async () => {
    const { route } = await load("both");
    telegramFetch.mockImplementation(async () => new Response("{}", { status: 500 }));
    expect((await route.POST(send(GOOD, "1.0.0.2"))).status).toBe(200);
    vi.resetModules();
  });

  it("says so, and lets the visitor retry, when no channel took it", async () => {
    const { route } = await load("both");
    telegramFetch.mockImplementation(async () => new Response("{}", { status: 500 }));
    sendEmail.mockImplementation(async () => {
      throw new Error("resend down");
    });
    const body = { ...GOOD, requestId: id() };
    const first = await route.POST(send(body, "1.0.0.3"));
    expect(first.status).toBe(502);
    expect(await first.json()).toMatchObject({ error: "send_failed", fallback: "mailto" });
    // the same request id may be tried again, because nothing was delivered
    telegramFetch.mockImplementation(async () => new Response("{}", { status: 200 }));
    sendEmail.mockImplementation(async () => undefined);
    expect((await route.POST(send(body, "1.0.0.3"))).status).toBe(200);
  });

  it("with no channel configured it says it is not set up and points to email", async () => {
    const { route } = await load("none");
    const res = await route.POST(send(GOOD, "1.0.0.4"));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "not_configured", fallback: "mailto" });
  });

  it("delivers the same request id once: a double click gets the same answer and no second message", async () => {
    const { route } = await load("both");
    const body = { ...GOOD, requestId: id() };
    expect((await route.POST(send(body, "1.0.0.5"))).status).toBe(200);
    const again = await route.POST(send(body, "1.0.0.5"));
    expect(await again.json()).toMatchObject({ ok: true, duplicate: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(telegramFetch).toHaveBeenCalledTimes(1);
  });

  it("refuses a bad body with the field that is wrong, and bad JSON, and a huge body", async () => {
    const { route } = await load("both");
    const bad = await route.POST(send({ ...GOOD, email: "nope" }, "1.0.0.6"));
    expect(bad.status).toBe(400);
    expect((await bad.json()).issues.map((i: { path: string }) => i.path)).toContain("email");
    expect((await route.POST(send("{not json", "1.0.0.6"))).status).toBe(400);
    expect((await route.POST(send({ ...GOOD, message: "m".repeat(7000) }, "1.0.0.6"))).status).toBe(413);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("refuses more than two links, and a request id that is not a UUID", async () => {
    const { route } = await load("both");
    const links = await route.POST(
      send({ ...GOOD, message: "check http://a.io http://b.io http://c.io please" }, "1.0.0.7"),
    );
    expect(links.status).toBe(400);
    const id2 = await route.POST(send({ ...GOOD, requestId: "123" }, "1.0.0.7"));
    expect(id2.status).toBe(400);
  });

  it("a filled honeypot looks like success to a bot and delivers nothing", async () => {
    const { route } = await load("both");
    const res = await route.POST(send({ ...GOOD, website: "http://spam.example" }, "1.0.0.8"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(telegramFetch).not.toHaveBeenCalled();
  });

  it("strips control characters and sends the cleaned message", async () => {
    const { route } = await load("email");
    await route.POST(
      send(
        {
          ...GOOD,
          name: "Asha\u0007\nRao",
          message: "Hello\u0000 Vishal,\r\n\r\n\r\n\r\nwe would like to talk.",
        },
        "1.0.0.9",
      ),
    );
    const [sub] = sendEmail.mock.calls[0]! as [{ name: string; message: string }];
    expect(sub.name).toBe("Asha Rao");
    expect(sub.message).toBe("Hello Vishal,\n\nwe would like to talk.");
  });

  it("limits each client to 3 messages in 10 minutes, and a different client is not affected", async () => {
    const { route } = await load("both");
    for (let i = 0; i < 3; i++) expect((await route.POST(send(GOOD, "2.0.0.1"))).status).toBe(200);
    const blocked = await route.POST(send(GOOD, "2.0.0.1"));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect((await route.POST(send(GOOD, "2.0.0.2"))).status).toBe(200);
  });

  it("rejects a request from another site", async () => {
    const { route } = await load("both");
    const res = await route.POST(send(GOOD, "3.0.0.1", { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("once-only and daily-cap guards", () => {
  it("claimOnce is true the first time only, and releaseClaim reopens it", async () => {
    const { once } = await load("none");
    once.resetOnce();
    expect(await once.claimOnce("k", 60)).toBe(true);
    expect(await once.claimOnce("k", 60)).toBe(false);
    await once.releaseClaim("k");
    expect(await once.claimOnce("k", 60)).toBe(true);
  });

  it("the global daily cap stops further messages, and resets the next day", async () => {
    const { once } = await load("none");
    once.resetOnce();
    const day1 = new Date("2026-10-04T10:00:00Z");
    expect(await once.underDailyCap("t", 2, day1)).toBe(true);
    expect(await once.underDailyCap("t", 2, day1)).toBe(true);
    expect(await once.underDailyCap("t", 2, day1)).toBe(false);
    expect(await once.underDailyCap("t", 2, new Date("2026-10-05T10:00:00Z"))).toBe(true);
  });
});
