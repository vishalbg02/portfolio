import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  failingModel,
  interruptedModel,
  jsonModel,
  metaOf,
  mockProvider,
  post,
  readEvents,
  streamingModel,
  textOf,
} from "./helpers/ai";

/** Fresh module graph per test (cooldowns, budget and rate limits start empty). */
async function load(limits: Record<string, number> = {}) {
  vi.resetModules();
  if (Object.keys(limits).length > 0)
    vi.doMock("@/lib/ai/limits", async (orig) => {
      const real = await orig<typeof import("@/lib/ai/limits")>();
      return { ...real, LIMITS: { ...real.LIMITS, ...limits } };
    });
  const provider = await import("@/lib/ai/provider");
  const chat = await import("@/app/api/chat/route");
  const routes = await import("@/lib/ai/routes");
  return { provider, chat, routes };
}
const ask = (q: string, ip = "1.1.1.1") =>
  post("/api/chat", { messages: [{ role: "user", content: q }] }, { "x-forwarded-for": ip });
const Q = "What has he built with Spring Boot?";

const apiError = (statusCode: number, responseHeaders: Record<string, string> = {}) =>
  new APICallError({
    message: `HTTP ${statusCode}`,
    url: "https://example.test",
    requestBodyValues: {},
    statusCode,
    responseHeaders,
  });
const erroringModel = (error: Error) =>
  new MockLanguageModelV4({
    doStream: async () => {
      throw error;
    },
  });
/** Never answers, but gives up when told to (like a real fetch). */
const hangingModel = () =>
  new MockLanguageModelV4({
    doStream: ({ abortSignal }) =>
      new Promise((_, reject) =>
        abortSignal?.addEventListener("abort", () => reject(abortSignal.reason ?? new Error("aborted"))),
      ),
  });

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.doUnmock("@/lib/ai/limits");
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("route cooldowns", () => {
  it("orders healthy routes first and keeps the original order otherwise", async () => {
    const { routes } = await load();
    const r = [{ name: "a" }, { name: "b" }, { name: "c" }];
    expect(routes.orderRoutes(r).map((x) => x.name)).toEqual(["a", "b", "c"]);
    routes.markFailed("a", apiError(429), 1_000);
    expect(routes.orderRoutes(r, 2_000).map((x) => x.name)).toEqual(["b", "c", "a"]);
    expect(routes.orderRoutes(r, 1_000 + 61_000).map((x) => x.name)).toEqual(["a", "b", "c"]);
  });

  it("honours Retry-After on a 429, and a success clears the cooldown", async () => {
    const { routes } = await load();
    const r = [{ name: "a" }, { name: "b" }];
    routes.markFailed("a", apiError(429, { "retry-after": "5" }), 0);
    expect(routes.orderRoutes(r, 4_000)[0]!.name).toBe("b");
    expect(routes.orderRoutes(r, 5_001)[0]!.name).toBe("a");
    routes.markFailed("a", apiError(429), 0);
    routes.markOk("a");
    expect(routes.orderRoutes(r, 1)[0]!.name).toBe("a");
  });

  it("treats a rejected key or retired model as long-lived, an outage as short", async () => {
    const { routes } = await load();
    const r = [{ name: "a" }, { name: "b" }];
    routes.markFailed("a", apiError(401), 0);
    expect(routes.orderRoutes(r, 5 * 60_000)[0]!.name).toBe("b");
    routes.resetRoutes();
    routes.markFailed("a", new Error("socket hang up"), 0);
    expect(routes.orderRoutes(r, 21_000)[0]!.name).toBe("a");
  });

  it("reads the status through a retry wrapper", async () => {
    const { routes } = await load();
    expect(routes.statusOf({ lastError: apiError(503) })).toBe(503);
    expect(routes.statusOf(new Error("plain"))).toBeNull();
  });
});

describe("provider routes", () => {
  it("builds the chain from whichever keys are present", async () => {
    const { provider } = await load();
    expect(provider.createProvider({})).toBeNull();
    const both = provider.createProvider({ gemini: "g", groq: "q" })!;
    expect(both.chatRoutes().map((r) => r.name)).toEqual(["gemini", "groq-120b", "groq-20b"]);
    expect(both.matchRoutes().map((r) => r.name)).toEqual(["gemini", "groq-120b"]);
    expect(both.embeddingModel()).not.toBeNull();
    const groqOnly = provider.createProvider({ groq: "q" })!;
    expect(groqOnly.chatRoutes().map((r) => r.name)).toEqual(["groq-120b", "groq-20b"]);
    expect(groqOnly.embeddingModel()).toBeNull(); // Groq has no embeddings: keyword retrieval
    expect(
      provider
        .createProvider({ gemini: "g" })!
        .chatRoutes()
        .map((r) => r.name),
    ).toEqual(["gemini"]);
  });

  it("gives reasoning routes headroom in output tokens and asks for low effort", async () => {
    const { provider } = await load();
    const groq = provider.createProvider({ groq: "q" })!.chatRoutes()[0]!;
    expect(groq.extraOutputTokens).toBeGreaterThan(0);
    expect(groq.providerOptions).toEqual({ groq: { reasoningEffort: "low" } });
  });
});

describe("/api/chat — falling over between routes", () => {
  it("answers from the next route when the first fails before showing anything", async () => {
    const first = failingModel();
    const second = streamingModel(["Spring Boot at Kaha [1]."]);
    const { chat, provider } = await load();
    provider.setProviderForTests(mockProvider([first, second]));
    const events = await readEvents(await chat.POST(ask(Q)));
    expect(metaOf(events).mode).toBe("ai");
    expect(textOf(events)).toBe("Spring Boot at Kaha [1].");
    expect(first.doStreamCalls).toHaveLength(1);
    expect(second.doStreamCalls).toHaveLength(1);
  });

  it("goes to the offline answer only when every route has failed", async () => {
    const { chat, provider } = await load();
    provider.setProviderForTests(mockProvider([failingModel(), failingModel(), failingModel()]));
    const events = await readEvents(await chat.POST(ask(Q, "2.2.2.2")));
    expect(metaOf(events)).toMatchObject({ mode: "offline", reason: "error" });
    expect(textOf(events)).toContain("Spring Boot");
  });

  it("skips a route that just hit its quota, so the next question does not wait on it", async () => {
    const limited = erroringModel(apiError(429));
    const healthy = streamingModel(["ok [1]"]);
    const { chat, provider } = await load();
    provider.setProviderForTests(mockProvider([limited, healthy]));
    await readEvents(await chat.POST(ask(Q, "3.3.3.1")));
    await readEvents(await chat.POST(ask(Q, "3.3.3.2")));
    expect(limited.doStreamCalls).toHaveLength(1); // not tried again while cooling down
    expect(healthy.doStreamCalls).toHaveLength(2);
  });

  it("gives up on a route that shows nothing in time", async () => {
    const hung = hangingModel();
    const healthy = streamingModel(["fine [1]"]);
    const { chat, provider } = await load({ firstTokenMs: 40 });
    provider.setProviderForTests(mockProvider([hung, healthy]));
    const events = await readEvents(await chat.POST(ask(Q, "4.4.4.4")));
    expect(textOf(events)).toBe("fine [1]");
  });

  it("does not switch routes once a route has started answering", async () => {
    const dying = interruptedModel("Vishal worked on ");
    const spare = streamingModel(["never shown"]);
    const { chat, provider } = await load();
    provider.setProviderForTests(mockProvider([dying, spare]));
    const events = await readEvents(await chat.POST(ask(Q, "5.5.5.5")));
    expect(textOf(events)).toBe("Vishal worked on ");
    expect(events.at(-1)).toMatchObject({ t: "error" });
    expect(spare.doStreamCalls).toHaveLength(0);
  });

  it("spends the daily budget once per question, not once per route", async () => {
    const { chat, provider } = await load();
    provider.setProviderForTests(mockProvider([failingModel(), streamingModel(["ok [1]"])]));
    vi.stubEnv("AI_DAILY_LIMIT", "1");
    const budget = await import("@/lib/ai/budget");
    const spy = vi.spyOn(budget, "consumeDaily");
    await readEvents(await chat.POST(ask(Q, "6.6.6.6")));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("job matcher — falling over between routes", () => {
  it("uses the next route when the first fails, and still grades literally", async () => {
    const { provider } = await load();
    const good = jsonModel({ requirements: [{ skill: "Java", importance: "high" }] });
    provider.setProviderForTests(mockProvider(streamingModel(["x"]), [failingModel(), good]));
    const { runMatch } = await import("@/lib/match/run");
    const result = await runMatch("We need a Java engineer.");
    expect(result.mode).toBe("ai");
    expect(result.results.find((r) => r.requirement === "Java")?.match).toBe("strong");
  });

  it("falls back to keyword extraction when every route fails", async () => {
    const { provider } = await load();
    provider.setProviderForTests(mockProvider(streamingModel(["x"]), [failingModel(), failingModel()]));
    const { runMatch } = await import("@/lib/match/run");
    expect((await runMatch("We need a Java engineer with Spring Boot.")).mode).toBe("keyword");
  });
});

describe("model text normalisation", () => {
  it("turns Groq's 【3】 citations and non-breaking hyphens into [3] and '-'", async () => {
    const { normalizeModelText } = await import("@/lib/ai/sanitize");
    expect(normalizeModelText("Built it【3】. Real‑time data【1】【2】.")).toBe(
      "Built it[3]. Real-time data[1][2].",
    );
  });
});
