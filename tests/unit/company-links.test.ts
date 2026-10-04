import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanLabel, parseLinkArgs } from "@/lib/links/label";
import { rankForRole } from "@/lib/links/role";
import { profile } from "@/content/profile";
import { SHAPE, validToken } from "@/lib/links/session";
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

describe("link labels", () => {
  it("keep letters, digits and a few marks, one space between words, and a length cap", () => {
    expect(cleanLabel("  Info<script>sys\n  Ltd.  ", 40)).toBe("Info script sys Ltd.");
    expect(cleanLabel("Tata & Sons (India)", 40)).toBe("Tata & Sons (India)");
    expect(cleanLabel("a".repeat(100), 40)).toHaveLength(40);
    expect(cleanLabel("Zoho 🚀 Corp", 40)).toBe("Zoho Corp");
    expect(cleanLabel("日本 Company", 40)).toBe("日本 Company");
  });

  it("/link Infosys SDE is Infosys and SDE; a | separates a longer company name; one word is the company", () => {
    expect(parseLinkArgs("Infosys SDE")).toEqual({ company: "Infosys", role: "SDE" });
    expect(parseLinkArgs("Infosys Full Stack Developer")).toEqual({
      company: "Infosys",
      role: "Full Stack Developer",
    });
    expect(parseLinkArgs("Tata Consultancy | Java Developer")).toEqual({
      company: "Tata Consultancy",
      role: "Java Developer",
    });
    expect(parseLinkArgs("Zoho")).toEqual({ company: "Zoho", role: null });
    expect(parseLinkArgs("Zoho |")).toEqual({ company: "Zoho", role: null });
  });

  it("refuses an empty or symbol-only company", () => {
    for (const bad of ["", "   ", "|", "| SDE", "!!! SDE", "🚀"]) expect(parseLinkArgs(bad), bad).toBeNull();
  });
});

describe("role ranking", () => {
  const skills = Object.values(profile.skills).flat();

  it("only ever names skills and projects that are in the profile", () => {
    for (const role of [
      "SDE",
      "Backend Developer",
      "Frontend",
      "Android developer",
      "Data engineer",
      "AI engineer",
      "DevOps",
      "Astronaut",
      null,
    ]) {
      const r = rankForRole(role);
      for (const s of r.skills) expect(skills, `${role}: ${s}`).toContain(s);
      for (const p of r.projects) {
        expect(profile.projects.map((x) => x.slug)).toContain(p.slug);
        expect(p.skills.length).toBeGreaterThan(0);
        for (const s of p.skills) expect(r.skills).toContain(s);
      }
      expect(r.projects.length).toBeLessThanOrEqual(3);
    }
  });

  it("a backend role leads with Java and Spring; a frontend one with React; a mobile one with Flutter", () => {
    expect(rankForRole("Backend Developer").skills).toEqual(expect.arrayContaining(["Java", "Spring Boot"]));
    expect(rankForRole("Backend Developer").skills).not.toContain("Flutter");
    expect(rankForRole("Frontend Engineer").skills).toEqual(expect.arrayContaining(["React", "Next.js"]));
    expect(rankForRole("Mobile developer").skills).toEqual(expect.arrayContaining(["Flutter", "Dart"]));
    expect(rankForRole("Mobile developer").projects[0]?.slug).toBe("talnio");
  });

  it("never leaves a generic role with nothing to show: 'SDE' gets projects, each with the skills it used", () => {
    for (const role of ["SDE", "Software Engineer", "Full Stack Developer", null, "Astronaut"]) {
      const r = rankForRole(role);
      expect(r.projects.length, String(role)).toBeGreaterThanOrEqual(2);
      expect(r.skills.length, String(role)).toBeGreaterThanOrEqual(4);
      // the most relevant project is the one that used the most of the listed skills
      expect(r.projects[0]!.skills.length).toBeGreaterThanOrEqual(r.projects.at(-1)!.skills.length);
    }
  });

  it("is deterministic, and falls back to his own core skills for 'SDE', no role, or a role it has no words for", () => {
    expect(rankForRole("SDE")).toEqual(rankForRole("SDE"));
    expect(rankForRole(null).label).toBe(profile.targetRole.title);
    expect(rankForRole("SDE").skills.length).toBeGreaterThan(2);
    expect(rankForRole("Astronaut").skills).toEqual(expect.arrayContaining(["Java"]));
    expect(rankForRole("  ").label).toBe(profile.targetRole.title);
  });
});

describe("the code in the browser", () => {
  it("has a fixed shape, so a hand-typed value is refused before anything is asked of the server", () => {
    expect(validToken("ab12cd34.AbCdEfGhIjKlMnOp")).toBe(true);
    for (const bad of [
      "",
      "nope",
      "ab12cd34",
      "AB12CD34.AbCdEfGhIjKlMnOp",
      "ab12cd34.short",
      "ab12cd34.<script>alert(1)</script>",
      null,
      42,
    ])
      expect(validToken(bad), String(bad)).toBe(false);
    expect(SHAPE.test("a".repeat(8) + "." + "b".repeat(16))).toBe(true);
  });
});

async function setup() {
  const infra = await loadLive();
  const hook = (await import("@/app/api/telegram/webhook/route")).POST;
  const open = (await import("@/app/api/link/route")).GET;
  const event = (await import("@/app/api/link/event/route")).POST;
  const tg = (text: string, uid = Math.floor(Math.random() * 1e9)) =>
    hook(
      new Request("http://localhost:3000/api/telegram/webhook", {
        method: "POST",
        headers: { host: "localhost:3000", "x-telegram-bot-api-secret-token": "hook-secret" },
        body: JSON.stringify({
          update_id: uid,
          message: { message_id: uid, text, chat: { id: 4242, type: "private" } },
        }),
      }),
    );
  const get = (c: string, ip = "7.7.7.1") =>
    open(
      new Request(`http://localhost:3000/api/link?c=${encodeURIComponent(c)}`, {
        headers: { host: "localhost:3000", "x-forwarded-for": ip },
      }),
    );
  const post = (body: unknown, ip = "7.7.7.1") =>
    event(
      new Request("http://localhost:3000/api/link/event", {
        method: "POST",
        headers: { host: "localhost:3000", "x-forwarded-for": ip, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  const made = async (arg = "Infosys SDE") => {
    await tg(`/link ${arg}`);
    const text = infra.telegram.at(-1)!.text;
    const url = /<code>(https?:\/\/[^<]+)<\/code>/.exec(text)?.[1];
    return { text, url, token: url ? new URL(url).searchParams.get("c")! : "" };
  };
  return { ...infra, hook, tg, get, post, made };
}

describe("/link in Telegram", () => {
  it("makes a signed link for the company and role, and says what it will tell him", async () => {
    const r = await setup();
    const { text, url, token } = await r.made("Infosys SDE");
    expect(text).toContain("Infosys");
    expect(text).toContain("SDE");
    expect(url).toMatch(/\/\?c=[a-z0-9]{8}\.[A-Za-z0-9_-]{16}$/);
    expect(validToken(token)).toBe(true);
    expect(text).toContain("90 days");
    expect(text).toContain("résumé");
    expect(r.store.links.size).toBe(1);
    expect([...r.store.links.values()][0]).toMatchObject({ company: "Infosys", role: "SDE" });
  });

  it("explains the syntax when the company is missing, and creates nothing", async () => {
    const r = await setup();
    await r.tg("/link");
    expect(r.telegram.at(-1)!.text).toContain("/link Infosys SDE");
    await r.tg("/link !!!");
    expect(r.store.links.size).toBe(0);
  });

  it("/links lists the newest with their open counts", async () => {
    const r = await setup();
    await r.tg("/links");
    expect(r.telegram.at(-1)!.text).toContain("No links yet");
    const a = await r.made("Infosys SDE");
    await r.made("Tata Consultancy | Java Developer");
    await r.get(a.token);
    await r.tg("/links");
    const text = r.telegram.at(-1)!.text;
    expect(text).toContain("Tata Consultancy");
    expect(text).toContain("Infosys");
    expect(text).toMatch(/Infosys.*: 1 open/);
    expect(text).toMatch(/Tata Consultancy.*: 0 opens/);
  });

  it("escapes what he typed", async () => {
    const r = await setup();
    const { text } = await r.made("A&B <b>x</b> | R&D");
    expect(text).toContain("A&amp;B");
    expect(text).not.toContain("<b>x</b>");
  });

  it("only he can make one", async () => {
    const r = await setup();
    const before = r.telegram.length;
    await r.hook(
      new Request("http://localhost:3000/api/telegram/webhook", {
        method: "POST",
        headers: { host: "localhost:3000", "x-telegram-bot-api-secret-token": "hook-secret" },
        body: JSON.stringify({
          update_id: 1,
          message: { message_id: 1, text: "/link Evil Corp", chat: { id: 999, type: "private" } },
        }),
      }),
    );
    expect(r.telegram.length).toBe(before);
    expect(r.store.links.size).toBe(0);
  });
});

describe("GET /api/link", () => {
  it("returns only the labels he typed, and pings him on the first open (once in six hours)", async () => {
    const r = await setup();
    const { token } = await r.made("Infosys SDE");
    const before = r.telegram.length;
    const res = await r.get(token);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j).toMatchObject({ ok: true, company: "Infosys", role: "SDE" });
    expect(Object.keys(j).sort()).toEqual(["company", "id", "ok", "role"]);
    expect(r.telegram.length).toBe(before + 1);
    expect(r.telegram.at(-1)!.text).toMatch(/Infosys.*SDE.*link opened/);
    await r.get(token);
    await r.get(token);
    expect(r.telegram.length).toBe(before + 1); // not pinged again
    expect(r.store.linkOpens.get(j.id)).toBe(3); // but counted
  });

  it("a made-up, altered, truncated or unknown code is a plain 404 that says nothing about why", async () => {
    const r = await setup();
    const { token } = await r.made("Infosys SDE");
    const [id, sig] = token.split(".");
    const bodies = new Set<string>();
    for (const bad of [
      `${id}.${sig!.slice(0, -1)}A`,
      `${id}.`,
      `zzzzzzzz.${sig}`,
      "garbage",
      "x".repeat(60),
      "<script>.x",
    ]) {
      const res = await r.get(bad);
      expect([404], bad).toContain(res.status);
      bodies.add(JSON.stringify(await res.json()));
    }
    expect([...bodies]).toEqual(['{"ok":false}']);
  });

  it("a link made with another signing secret does not verify", async () => {
    const r = await setup();
    const { token } = await r.made("Infosys SDE");
    vi.stubEnv("LIVE_CHAT_SIGNING_SECRET", "a-different-secret");
    vi.resetModules();
    const infra = await loadLive({ env: { LIVE_CHAT_SIGNING_SECRET: "a-different-secret" } });
    infra.store.links = r.store.links; // same database, new secret
    const open = (await import("@/app/api/link/route")).GET;
    const res = await open(
      new Request(`http://localhost:3000/api/link?c=${token}`, { headers: { host: "localhost:3000" } }),
    );
    expect(res.status).toBe(404);
  });

  it("is off, with a plain 404, when the live chat isn't switched on (no database, no secret)", async () => {
    vi.resetModules();
    for (const k of [
      "TELEGRAM_BOT_TOKEN",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "LIVE_CHAT_SIGNING_SECRET",
    ])
      vi.stubEnv(k, "");
    const open = (await import("@/app/api/link/route")).GET;
    const res = await open(
      new Request("http://localhost:3000/api/link?c=ab12cd34.AbCdEfGhIjKlMnOp", {
        headers: { host: "localhost:3000" },
      }),
    );
    expect(res.status).toBe(404);
  });

  it("is rate limited per client", async () => {
    const r = await setup();
    const { token } = await r.made("Infosys SDE");
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++) statuses.push((await r.get(token, "5.5.5.5")).status);
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(20)).toEqual([429, 429]);
    expect((await r.get(token, "6.6.6.6")).status).toBe(200); // someone else is fine
  });

  it("refuses a request from another site (cross-origin)", async () => {
    const r = await setup();
    const { token } = await r.made("Infosys SDE");
    const res = await (
      await import("@/app/api/link/route")
    ).GET(
      new Request(`http://localhost:3000/api/link?c=${token}`, {
        headers: { host: "localhost:3000", origin: "https://evil.example" },
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/link/event", () => {
  it("tells him about a résumé download and a chat start, once an hour each", async () => {
    const r = await setup();
    const { token } = await r.made("Infosys SDE");
    const before = r.telegram.length;
    expect((await r.post({ c: token, e: "resume" })).status).toBe(200);
    expect(r.telegram.at(-1)!.text).toMatch(/📄.*Infosys.*downloaded the résumé/);
    await r.post({ c: token, e: "resume" });
    expect(r.telegram.length).toBe(before + 1);
    await r.post({ c: token, e: "chat" });
    expect(r.telegram.at(-1)!.text).toMatch(/💬.*Infosys.*started a chat/);
    expect(r.telegram.length).toBe(before + 2);
  });

  it("sends nothing for a bad code or a kind it does not know, and takes no personal data", async () => {
    const r = await setup();
    const { token } = await r.made("Infosys SDE");
    const before = r.telegram.length;
    expect((await r.post({ c: "garbage.garbagegarbage", e: "resume" })).status).toBe(200);
    expect((await r.post({ c: token, e: "email" })).status).toBe(400);
    expect((await r.post("nope")).status).toBe(400);
    expect(r.telegram.length).toBe(before);
    // extra fields are ignored; the ping carries the link's labels and the time, nothing else
    await r.post({ c: token, e: "resume", name: "Asha", email: "a@b.co" });
    expect(r.telegram.at(-1)!.text).not.toMatch(/Asha|a@b\.co/);
  });
});
