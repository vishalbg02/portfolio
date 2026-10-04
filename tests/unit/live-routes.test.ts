import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { post } from "./helpers/ai";
import { loadLive } from "./helpers/live";

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.doUnmock("@/lib/rate-limit");
  vi.doUnmock("@/lib/notify/once");
  vi.doUnmock("@/lib/email/send");
});

const START = {
  name: "Asha Rao",
  message: "Hello Vishal, we'd like to talk about a backend role.",
  page: "/work",
};
const send = (body: unknown, ip = "9.9.9.1", headers: Record<string, string> = {}) =>
  post("/api/live/message", typeof body === "string" ? body : body, { "x-forwarded-for": ip, ...headers });
const get = (path: string) =>
  new Request(`http://localhost:3000${path}`, { headers: { host: "localhost:3000" } });

async function routes(opts: Parameters<typeof loadLive>[0] = {}) {
  const infra = await loadLive(opts);
  return {
    ...infra,
    message: (await import("@/app/api/live/message/route")).POST,
    poll: (await import("@/app/api/live/poll/route")).GET,
    presence: (await import("@/app/api/live/presence/route")).GET,
    contact: (await import("@/app/api/live/contact/route")).POST,
    unsub: await import("@/app/api/live/unsubscribe/route"),
    hook: (await import("@/app/api/telegram/webhook/route")).POST,
    digest: (await import("@/app/api/cron/digest/route")).GET,
  };
}

/** Starts a conversation as a visitor and returns what the browser would keep. */
async function begin(
  r: Awaited<ReturnType<typeof routes>>,
  over: Record<string, unknown> = {},
  ip = "9.9.9.1",
) {
  const res = await r.message(send({ ...START, ...over }, ip));
  const j = await res.json();
  return { res, ...j } as {
    res: Response;
    ok: boolean;
    c: string;
    k: string;
    n: number;
    presence: { state: string };
  };
}

describe("visitor → Vishal: POST /api/live/message", () => {
  it("starts a conversation: it reaches his Telegram first, then the thread is stored", async () => {
    const r = await routes();
    const s = await begin(r, { email: "asha@example.com", org: "Infosys" });
    expect(s.res.status).toBe(200);
    expect(s).toMatchObject({ ok: true, n: 1, presence: { state: "away" } });
    expect(s.k).toMatch(/^[A-Za-z0-9_-]{24}$/);
    // what he sees
    expect(r.telegram).toHaveLength(1);
    const ping = r.telegram[0]!;
    expect(ping.text).toContain("<b>Asha Rao (Infosys)</b>");
    expect(ping.text).toMatch(/<code>#[0-9a-f]{6}<\/code>/);
    expect(ping.text).toContain("asha@example.com");
    expect(ping.text).toContain("/work");
    expect(ping.text).toContain("Reply to this message to answer.");
    // what is stored
    const conv = await r.store.getConv(s.c);
    expect(conv).toMatchObject({
      name: "Asha Rao",
      email: "asha@example.com",
      org: "Infosys",
      via: "live",
      blocked: false,
    });
    expect(await r.store.messages(s.c, 0)).toMatchObject([{ n: 1, from: "visitor", text: START.message }]);
    expect(await r.store.convForTelegram(ping.messageId)).toBe(s.c);
    expect((await r.store.listPending(5)).map((p) => p.id)).toEqual([s.c]);
  });

  it("escapes everything the visitor typed before it goes to Telegram", async () => {
    const r = await routes();
    await begin(r, {
      name: "<b>Eve</b>",
      org: "A&B <Corp>",
      message: "<script>alert(1)</script> & more text here",
    });
    const t = r.telegram[0]!.text;
    expect(t).not.toMatch(/<script|<b>Eve/);
    expect(t).toContain("&lt;b&gt;Eve&lt;/b&gt;");
    expect(t).toContain("A&amp;B &lt;Corp&gt;");
  });

  it("adds later messages to the same thread, short in Telegram, and numbers them", async () => {
    const r = await routes();
    const s = await begin(r);
    const res = await r.message(send({ c: s.c, k: s.k, message: "Are you there?" }));
    expect(await res.json()).toMatchObject({ ok: true, n: 2 });
    expect(r.telegram).toHaveLength(2);
    expect(r.telegram[1]!.text).not.toContain("Reply to this message"); // only the first carries the context
    expect(r.telegram[1]!.text).toContain("Are you there?");
    // replying to the second message also finds the thread
    expect(await r.store.convForTelegram(r.telegram[1]!.messageId)).toBe(s.c);
  });

  it("does not store anything when Vishal can't be reached, and says so", async () => {
    const r = await routes({ telegramOk: false });
    const res = await r.message(send(START));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: "send_failed", fallback: "mailto" });
    expect(r.store.convs.size).toBe(0);
  });

  it("refuses what it should: another site, bad JSON, a big body, bad fields, no name for a new chat, a bot's honeypot", async () => {
    const r = await routes();
    expect((await r.message(send(START, "9.9.9.2", { origin: "https://evil.example" }))).status).toBe(403);
    expect((await r.message(send("{nope", "9.9.9.2"))).status).toBe(400);
    expect((await r.message(send({ ...START, message: "m".repeat(9000) }, "9.9.9.2"))).status).toBe(413);
    expect((await r.message(send({ ...START, message: "" }, "9.9.9.2"))).status).toBe(400);
    expect((await r.message(send({ ...START, message: "a.io b.io c.io" }, "9.9.9.2"))).status).toBe(400);
    expect((await r.message(send({ ...START, email: "nope" }, "9.9.9.2"))).status).toBe(400);
    const noName = await r.message(send({ message: "hello there" }, "9.9.9.2"));
    expect(noName.status).toBe(400);
    expect((await noName.json()).issues[0].path).toBe("name");
    const bot = await r.message(send({ ...START, website: "http://spam.example" }, "9.9.9.3"));
    expect(bot.status).toBe(200);
    expect(r.telegram).toHaveLength(0);
    expect(r.store.convs.size).toBe(0);
  });

  it("is off when it isn't configured", async () => {
    const r = await routes({ env: { TELEGRAM_WEBHOOK_SECRET: "" } });
    expect((await r.message(send(START))).status).toBe(503);
    expect((await r.poll(get("/api/live/poll?c=x&k=y"))).status).toBe(503);
  });

  it("rejects a thread with the wrong signature, an expired thread, a blocked thread and a blocked client", async () => {
    const r = await routes();
    const s = await begin(r);
    expect((await r.message(send({ c: s.c, k: "x".repeat(24), message: "hi there" }))).status).toBe(403);
    expect((await r.message(send({ c: s.c, message: "hi there" }))).status).toBe(403);
    const { sign } = await import("@/lib/live/token");
    const ghost = "11111111-2222-4333-8444-555555555555";
    expect((await r.message(send({ c: ghost, k: sign(ghost), message: "hi there" }))).status).toBe(404);
    await r.store.updateConv(s.c, { blocked: true });
    expect((await r.message(send({ c: s.c, k: s.k, message: "hi there" }))).status).toBe(403);
    // a blocked client can't start a new one either
    const conv = (await r.store.getConv(s.c))!;
    await r.store.blockIp(conv.ipHash);
    expect((await r.message(send(START, "9.9.9.1"))).status).toBe(403);
  });

  it("limits a client to 5 new conversations a day, a thread to 30 messages an hour, and everyone to 100 chats a day", async () => {
    const r = await routes();
    for (let i = 0; i < 5; i++) expect((await r.message(send(START, "5.5.5.5"))).status).toBe(200);
    const blocked = await r.message(send(START, "5.5.5.5"));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();

    const s = await begin(r, {}, "6.6.6.6");
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) {
      // a fresh client address each time, so only the per-thread limit can stop it
      statuses.push(
        (await r.message(send({ c: s.c, k: s.k, message: `message number ${i}` }, `7.7.${i}.1`))).status,
      );
    }
    expect(statuses.slice(0, 30).every((x) => x === 200)).toBe(true); // 30 in the hour are fine
    expect(statuses[30]).toBe(429); // the 31st is not

    const busy = await routes();
    let status = 0;
    for (let i = 0; i < 101; i++)
      status = (await busy.message(send(START, `10.${Math.floor(i / 250)}.${i % 250}.1`))).status;
    expect(status).toBe(503);
  });

  it("checks Turnstile when its key is set: a missing or failing token is refused", async () => {
    const r = await routes({ env: { TURNSTILE_SECRET_KEY: "ts-secret" } });
    const missing = await r.message(send(START, "8.8.8.1"));
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ error: "bot_check_failed" });
    expect((await r.message(send({ ...START, turnstile: "good-token" }, "8.8.8.2"))).status).toBe(200);
    const call = r.fetchMock.mock.calls.find(([u]) => String(u).includes("challenges.cloudflare.com"))!;
    expect(String((call[1] as RequestInit).body)).toContain("secret=ts-secret");
    expect(String((call[1] as RequestInit).body)).toContain("response=good-token");

    r.fetchMock.mockImplementationOnce(
      async () => new Response(JSON.stringify({ success: false }), { status: 200 }),
    );
    expect((await r.message(send({ ...START, turnstile: "bad" }, "8.8.8.3"))).status).toBe(400);
    r.fetchMock.mockImplementationOnce(async () => {
      throw new Error("cloudflare unreachable");
    });
    expect((await r.message(send({ ...START, turnstile: "x" }, "8.8.8.4"))).status).toBe(400); // fails closed
  });

  it("without a Turnstile key there is no bot check, and the other protections still apply", async () => {
    const r = await routes();
    expect((await r.message(send(START, "8.8.8.9"))).status).toBe(200);
    expect(r.fetchMock.mock.calls.some(([u]) => String(u).includes("cloudflare"))).toBe(false);
  });
});

describe("GET /api/live/poll", () => {
  it("returns everything at first, 'unchanged' after that, and only the new messages when something arrives", async () => {
    const r = await routes();
    const s = await begin(r);
    const first = await (await r.poll(get(`/api/live/poll?c=${s.c}&k=${s.k}&after=0&v=-1`))).json();
    expect(first).toMatchObject({ changed: true, v: 1, messages: [{ n: 1, from: "visitor" }] });
    const same = await (await r.poll(get(`/api/live/poll?c=${s.c}&k=${s.k}&after=1&v=1`))).json();
    expect(same).toEqual({ changed: false, v: 1 });
    await r.store.append(s.c, { from: "vishal", text: "Hi Asha!", t: Date.now() });
    const next = await (await r.poll(get(`/api/live/poll?c=${s.c}&k=${s.k}&after=1&v=1`))).json();
    expect(next).toMatchObject({
      changed: true,
      v: 2,
      messages: [{ n: 2, from: "vishal", text: "Hi Asha!" }],
    });
  });

  it("notes that the visitor is on the site (so a reply they just saw is not also emailed)", async () => {
    const r = await routes();
    const s = await begin(r);
    expect(await r.store.lastSeen(s.c)).toBeNull();
    await r.poll(get(`/api/live/poll?c=${s.c}&k=${s.k}&after=1&v=1`));
    expect(await r.store.lastSeen(s.c)).toBeGreaterThan(0);
  });

  it("refuses a wrong signature or a malformed id, and reports an expired thread as gone", async () => {
    const r = await routes();
    const s = await begin(r);
    expect((await r.poll(get(`/api/live/poll?c=${s.c}&k=nope&after=0&v=-1`))).status).toBe(403);
    expect((await r.poll(get(`/api/live/poll?c=../etc&k=${s.k}`))).status).toBe(403);
    const { sign } = await import("@/lib/live/token");
    const ghost = "11111111-2222-4333-8444-555555555555";
    expect((await r.poll(get(`/api/live/poll?c=${ghost}&k=${sign(ghost)}&after=3&v=3`))).status).toBe(404);
  });
});

describe("presence, email capture and unsubscribe", () => {
  it("says online or away, caches for 15 seconds, and always includes his public email", async () => {
    const r = await routes();
    const away = await r.presence();
    expect(away.headers.get("cache-control")).toContain("s-maxage=15");
    expect(await away.json()).toMatchObject({
      configured: true,
      state: "away",
      email: "vishalbg02@gmail.com",
    });
    await r.store.setPresence({ mode: "online", hours: null, lastActiveAt: Date.now() });
    expect(await (await r.presence()).json()).toMatchObject({
      state: "online",
      label: "Online — replies in minutes",
    });
    const off = await routes({ env: { TELEGRAM_WEBHOOK_SECRET: "" } });
    expect(await (await off.presence()).json()).toMatchObject({
      configured: false,
      email: "vishalbg02@gmail.com",
    });
  });

  it("stores an email left later, tells Vishal, and refuses bad input", async () => {
    const r = await routes();
    const s = await begin(r);
    const ok = await r.contact(
      post("/api/live/contact", { c: s.c, k: s.k, email: "asha@example.com", org: "Infosys" }),
    );
    expect(ok.status).toBe(200);
    expect(await r.store.getConv(s.c)).toMatchObject({ email: "asha@example.com", org: "Infosys" });
    expect(r.telegram.at(-1)!.text).toContain("left an email: asha@example.com");
    expect((await r.contact(post("/api/live/contact", { c: s.c, k: s.k, email: "nope" }))).status).toBe(400);
    expect(
      (await r.contact(post("/api/live/contact", { c: s.c, k: "x".repeat(24), email: "a@b.co" }))).status,
    ).toBe(403);
  });

  it("the unsubscribe link stops emails for that thread only, with a page that says so", async () => {
    const r = await routes();
    const s = await begin(r, { email: "asha@example.com" });
    const other = await begin(r, { email: "bo@example.com" }, "9.9.9.5");
    const res = await r.unsub.GET(get(`/api/live/unsubscribe?c=${s.c}&k=${s.k}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("No more emails");
    expect((await r.store.getConv(s.c))!.optOut).toBe(true);
    expect((await r.store.getConv(other.c))!.optOut).toBe(false);
    expect((await r.unsub.GET(get(`/api/live/unsubscribe?c=${s.c}&k=bad`))).status).toBe(404);
    // mail programs' one-click form
    expect((await r.unsub.POST(get(`/api/live/unsubscribe?c=${other.c}&k=${other.k}`))).status).toBe(200);
    expect((await r.store.getConv(other.c))!.optOut).toBe(true);
  });
});

/* ── Telegram → visitor ──────────────────────────────────────────────────────────────────────────── */

let uid = 100;
const update = (text: string, extra: Record<string, unknown> = {}, chat = 4242, type = "private") => ({
  update_id: ++uid,
  message: { message_id: uid, text, chat: { id: chat, type }, ...extra },
});
const hook = (r: Awaited<ReturnType<typeof routes>>, u: unknown, secret = "hook-secret") =>
  r.hook(
    new Request("http://localhost:3000/api/telegram/webhook", {
      method: "POST",
      headers: { host: "localhost:3000", "x-telegram-bot-api-secret-token": secret },
      body: JSON.stringify(u),
    }),
  );

describe("POST /api/telegram/webhook", () => {
  it("only answers Telegram: a missing or wrong secret is refused", async () => {
    const r = await routes();
    expect((await hook(r, update("/help"), "")).status).toBe(401);
    expect((await hook(r, update("/help"), "hook-secreT")).status).toBe(401);
    expect(r.telegram).toHaveLength(0);
  });

  it("obeys only his own private chat; anyone else who finds the bot gets nothing", async () => {
    const r = await routes();
    await hook(r, update("/online", {}, 999999));
    await hook(r, update("/stats", {}, 4242, "group"));
    expect(r.telegram).toHaveLength(0);
    expect((await r.store.getPresence()).mode).toBe("auto");
  });

  it("handles an update once, however many times Telegram retries it", async () => {
    const r = await routes();
    const u = update("/help");
    await hook(r, u);
    await hook(r, u);
    await hook(r, u);
    expect(r.telegram).toHaveLength(1);
  });

  it("/online, /away and /hours change his presence and confirm it", async () => {
    const r = await routes();
    await hook(r, update("/online"));
    expect(await (await r.presence()).json()).toMatchObject({ state: "online" });
    expect(r.telegram.at(-1)!.text).toContain("You're online");
    await hook(r, update("/away"));
    expect(await (await r.presence()).json()).toMatchObject({ state: "away" });
    await hook(r, update("/hours 0-24".replace("0-24", "10-22")));
    expect((await r.store.getPresence()).hours).toEqual({ from: 10, to: 22 });
    expect(r.telegram.at(-1)!.text).toContain("10:00 and 22:00");
    await hook(r, update("/hours whenever"));
    expect(r.telegram.at(-1)!.text).toContain("Use /hours 10-22");
    expect((await r.store.getPresence()).hours).toEqual({ from: 10, to: 22 });
    await hook(r, update("/hours off"));
    expect((await r.store.getPresence()).hours).toBeNull();
    await hook(r, update("/online@GridBot"));
    expect((await r.store.getPresence()).mode).toBe("online"); // @botname is accepted
  });

  it("/stats shows today's counts and who is waiting; /help and unknown commands list the commands", async () => {
    const r = await routes();
    const s = await begin(r, { org: "Infosys" });
    await r.message(send({ c: s.c, k: s.k, message: "still there?" }));
    await hook(r, update("/stats"));
    const stats = r.telegram.at(-1)!.text;
    expect(stats).toContain("Live chats started: 1");
    expect(stats).toContain("Visitor messages: 2");
    expect(stats).toContain("Asha Rao (Infosys)");
    expect(stats).toContain("Vercel Analytics");
    await hook(r, update("/help"));
    expect(r.telegram.at(-1)!.text).toContain("/hours 10-22");
    await hook(r, update("/frobnicate"));
    expect(r.telegram.at(-1)!.text).toContain("/stats");
    await hook(r, update("/link Infosys SDE"));
    expect(r.telegram.at(-1)!.text).toContain("later update");
  });

  it("/block stops that visitor and their address, and says if the id is unknown", async () => {
    const r = await routes();
    const s = await begin(r);
    const conv = (await r.store.getConv(s.c))!;
    await hook(r, update(`/block #${conv.short}`));
    expect(r.telegram.at(-1)!.text).toContain(`Blocked #${conv.short}`);
    expect((await r.store.getConv(s.c))!.blocked).toBe(true);
    expect(await r.store.isIpBlocked(conv.ipHash)).toBe(true);
    expect((await r.message(send({ c: s.c, k: s.k, message: "let me in" }))).status).toBe(403);
    await hook(r, update("/block zzzzzz"));
    expect(r.telegram.at(-1)!.text).toContain("Use /block");
  });

  it("a reply to a visitor's message lands in their thread, and he is told it was delivered", async () => {
    const r = await routes();
    const s = await begin(r);
    const original = r.telegram[0]!.messageId;
    const u = update("Hi Asha, yes, let's talk tomorrow at 11.", {
      reply_to_message: { message_id: original },
    });
    await hook(r, u);
    expect(await r.store.messages(s.c, 1)).toMatchObject([
      { n: 2, from: "vishal", text: "Hi Asha, yes, let's talk tomorrow at 11." },
    ]);
    expect((await r.store.getConv(s.c))!.lastOwnerAt).toBeGreaterThan(0);
    expect(await r.store.listPending(5)).toEqual([]); // no longer waiting
    const note = r.telegram.at(-1)!;
    expect(note.text).toContain("Sent to Asha Rao");
    expect(note.replyTo).toBe(u.message.message_id);
    // he is online now, because he just answered
    expect(await (await r.presence()).json()).toMatchObject({ state: "online" });
  });

  it("emails the reply if the visitor has left, has an address, hasn't opted out, and a sender exists", async () => {
    const r = await routes();
    const s = await begin(r, { email: "asha@example.com" });
    const reply = (text: string) =>
      hook(r, update(text, { reply_to_message: { message_id: r.telegram[0]!.messageId } }));
    // she is on the site right now: no email
    await r.store.touchSeen(s.c, Date.now());
    await reply("You're there!");
    expect(r.emails).toHaveLength(0);
    expect(r.telegram.at(-1)!.text).toContain("They're on the site right now.");
    // she left: emailed
    await r.store.touchSeen(s.c, Date.now() - 5 * 60_000);
    await reply("Tomorrow at 11 works.");
    expect(r.emails).toEqual([{ to: "asha@example.com", text: "Tomorrow at 11 works." }]);
    expect(r.telegram.at(-1)!.text).toContain("I emailed it too");
    // she opted out: not emailed
    await r.store.updateConv(s.c, { optOut: true });
    await reply("One more thing.");
    expect(r.emails).toHaveLength(1);
    expect(r.telegram.at(-1)!.text).toContain("stopped emails");
  });

  it("says plainly when it can't email: no address given, or no verified sender (and shows him the address)", async () => {
    const r = await routes();
    const noEmail = await begin(r, {}, "9.9.9.7");
    await hook(r, update("Hello!", { reply_to_message: { message_id: r.telegram.at(-1)!.messageId } }));
    expect(r.telegram.at(-1)!.text).toContain("didn't leave an email");
    expect((await r.store.getConv(noEmail.c))!.lastOwnerAt).toBeGreaterThan(0);

    const nosender = await routes({ sender: false });
    await begin(nosender, { email: "asha@example.com" });
    await hook(
      nosender,
      update("Hello!", { reply_to_message: { message_id: nosender.telegram[0]!.messageId } }),
    );
    const t = nosender.telegram.at(-1)!.text;
    expect(t).toContain("can't be emailed yet");
    expect(t).toContain("asha@example.com");
    expect(nosender.emails).toHaveLength(0);
  });

  it("caps reply emails at 5 a day per conversation", async () => {
    const r = await routes();
    await begin(r, { email: "asha@example.com" });
    for (let i = 0; i < 7; i++)
      await hook(r, update(`reply ${i}`, { reply_to_message: { message_id: r.telegram[0]!.messageId } }));
    expect(r.emails).toHaveLength(5);
  });

  it("a plain message, or a reply to something that isn't a visitor's message, gets a pointer instead of a guess", async () => {
    const r = await routes();
    await hook(r, update("hello?"));
    expect(r.telegram.at(-1)!.text).toContain("Reply to a visitor's message");
    await hook(r, update("hi", { reply_to_message: { message_id: 1 } }));
    expect(r.telegram.at(-1)!.text).toContain("couldn't match");
  });

  it("ignores updates that aren't text messages, and malformed bodies, with a 200 so Telegram stops retrying", async () => {
    const r = await routes();
    expect((await hook(r, { update_id: 1, edited_message: { text: "x" } })).status).toBe(200);
    expect((await hook(r, { nonsense: true })).status).toBe(200);
    const bad = await r.hook(
      new Request("http://localhost:3000/api/telegram/webhook", {
        method: "POST",
        headers: { host: "localhost:3000", "x-telegram-bot-api-secret-token": "hook-secret" },
        body: "{nope",
      }),
    );
    expect(bad.status).toBe(200);
    expect(r.telegram).toHaveLength(0);
  });
});

describe("GRID's message card feeds the same threads", () => {
  it("with live chat on, a confirmed GRID message becomes a conversation so his reply can reach the visitor", async () => {
    const r = await routes();
    const { POST } = await import("@/app/api/grid/message/route");
    const res = await POST(
      post(
        "/api/grid/message",
        {
          name: "Asha Rao",
          email: "asha@example.com",
          message: "Hello Vishal, a quick question about a role.",
          requestId: crypto.randomUUID(),
          page: "/work",
        },
        { "x-forwarded-for": "3.3.3.3" },
      ),
    );
    expect(res.status).toBe(200);
    expect(r.store.convs.size).toBe(1);
    const conv = [...r.store.convs.values()][0]!;
    expect(conv).toMatchObject({ via: "grid", email: "asha@example.com" });
    expect(r.telegram[0]!.text).toContain("sent from GRID's message card");
    // and his reply is emailed to her
    await hook(r, update("Happy to talk.", { reply_to_message: { message_id: r.telegram[0]!.messageId } }));
    expect(r.emails).toEqual([{ to: "asha@example.com", text: "Happy to talk." }]);
  });
});

describe("GET /api/cron/digest", () => {
  it("is for Vercel's cron only: it needs the bearer secret", async () => {
    const r = await routes();
    expect((await r.digest(get("/api/cron/digest"))).status).toBe(401);
    expect(
      (
        await r.digest(
          new Request("http://localhost:3000/api/cron/digest", {
            headers: { authorization: "Bearer wrong" },
          }),
        )
      ).status,
    ).toBe(401);
    expect(r.telegram).toHaveLength(0);
  });

  it("sends the day's numbers and who is waiting", async () => {
    const r = await routes();
    await begin(r);
    const res = await r.digest(
      new Request("http://localhost:3000/api/cron/digest", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    expect(await res.json()).toEqual({ ok: true });
    const text = r.telegram.at(-1)!.text;
    expect(text).toContain("Daily digest");
    expect(text).toContain("Live chats started: 1");
    expect(text).toContain("Waiting for your reply");
  });

  it("does nothing, quietly, when live chat isn't configured", async () => {
    const r = await routes({ env: { TELEGRAM_WEBHOOK_SECRET: "" } });
    const res = await r.digest(
      new Request("http://localhost:3000/api/cron/digest", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    expect(await res.json()).toEqual({ ok: true, skipped: "not_configured" });
  });
});

describe("GRID hands over to Vishal", () => {
  it("shows whether he is online and offers the live chat, with no model", async () => {
    const r = await routes();
    const { routeIntent } = await import("@/lib/ai/agent/router");
    const away = await routeIntent("Can I talk to him live?");
    expect(away?.parts[0]).toMatchObject({ tool: "start_live_chat", part: { kind: "live", state: "away" } });
    await r.store.setPresence({ mode: "online", hours: null, lastActiveAt: Date.now() });
    const online = await routeIntent("is he online?");
    expect(online?.parts[0]?.part).toMatchObject({ kind: "live", state: "online" });
    expect(online?.text).toMatch(/online right now/);
  });

  it("says plainly when live chat isn't switched on, and the tool carries a summary for the chat to start from", async () => {
    await routes({ env: { TELEGRAM_WEBHOOK_SECRET: "" } });
    const { routeIntent } = await import("@/lib/ai/agent/router");
    expect((await routeIntent("start a live chat"))?.parts[0]?.part).toMatchObject({
      kind: "live",
      state: "off",
    });
    const { buildTools } = await import("@/lib/ai/agent/tools");
    const { SourceRegistry } = await import("@/lib/ai/agent/sources");
    const t = buildTools({ sources: new SourceRegistry() }) as unknown as {
      start_live_chat: {
        execute: (
          i: unknown,
          o: unknown,
        ) => Promise<{ part: { kind: string; summary: string }; summary: string }>;
      };
    };
    const out = await t.start_live_chat.execute(
      { summary: "Asked about Spring Boot work and wants to discuss a role." },
      { toolCallId: "x", messages: [] },
    );
    expect(out.part).toMatchObject({
      kind: "live",
      summary: "Asked about Spring Boot work and wants to discuss a role.",
    });
    expect(out.summary).toMatch(/not switched on/);
  });
});
