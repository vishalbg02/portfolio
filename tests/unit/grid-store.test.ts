import { describe, expect, it, vi } from "vitest";
import { ChatHttpError } from "@/lib/ai/client";
import type { ChatEvent, UiPart } from "@/lib/ai/protocol";
import { LIMITS } from "@/lib/ai/limits";
import { STORAGE_KEY, createGridStore, type GridState } from "@/lib/grid/store";

type Script = ChatEvent[] | ((messages: unknown[]) => ChatEvent[] | Promise<never>);

const memory = () => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
};

const card: UiPart = { kind: "navigate", target: "contact", href: "/#contact", label: "Contact" };
const project: UiPart = {
  kind: "project",
  slug: "talnio",
  name: "Talnio",
  tagline: "Employee management platform",
  summary: "s",
  eyebrow: "e",
  stack: ["Flutter"],
  links: [],
  badge: null,
  live: false,
  image: null,
};

function make(
  script: Script = [{ t: "meta", mode: "ai", sources: [] }, { t: "text", d: "Hi." }, { t: "done" }],
) {
  const storage = memory();
  const calls: Array<{ messages: unknown[]; opts: unknown }> = [];
  const act = vi.fn();
  const track = vi.fn();
  const streamChat = vi.fn(
    async (messages: unknown[], onEvent: (e: ChatEvent) => void, _s: AbortSignal, opts: unknown) => {
      calls.push({ messages, opts });
      const events = typeof script === "function" ? await script(messages) : script;
      for (const e of events) onEvent(e);
    },
  );
  const store = createGridStore({
    streamChat: streamChat as never,
    storage: () => storage,
    act,
    track,
    fetchStatus: async () => true,
  });
  return { store, storage, calls, act, track, streamChat };
}
const last = (s: GridState) => s.messages.at(-1)!;

describe("GRID store: a conversation", () => {
  it("streams one turn into a user message and an assistant message with its text, sources, cards and follow-ups", async () => {
    const { store, track, act } = make([
      { t: "meta", mode: "ai", sources: [{ n: 1, title: "Talnio", url: "/work/talnio" }] },
      { t: "tool", id: "c1", name: "show_project", state: "running" },
      { t: "part", id: "c1", part: project },
      { t: "tool", id: "c1", name: "show_project", state: "done" },
      { t: "text", d: "Here is " },
      { t: "text", d: "Talnio [1]." },
      { t: "followups", items: ["a", "b", "c", "d"] },
      { t: "done" },
    ]);
    await store.send("Show me Talnio");
    const s = store.getState();
    expect(s.busy).toBe(false);
    expect(s.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    const bot = last(s);
    expect(bot.text).toBe("Here is Talnio [1].");
    expect(bot.sources).toHaveLength(1);
    expect(bot.parts.map((p) => p.part.kind)).toEqual(["project"]);
    expect(bot.tools).toEqual([{ id: "c1", name: "show_project", state: "done" }]);
    expect(bot.followups).toEqual(["a", "b", "c"]); // at most three
    expect(bot.pending).toBe(false);
    // analytics carry counts and tool names, never the question
    expect(track).toHaveBeenCalledWith("grid_question");
    expect(track).toHaveBeenCalledWith("grid_tool_used", { tool: "show_project" });
    expect(JSON.stringify(track.mock.calls)).not.toContain("Talnio");
    // the page was told about the card the moment it arrived
    expect(act).toHaveBeenCalledWith(project);
  });

  it("sends the last few turns as history, the mode only when it is not the default, and the project once", async () => {
    const { store, calls } = make();
    await store.send("one");
    store.setMode("recruiter");
    await store.send("two", { project: "talnio" });
    const second = calls[1]!;
    expect((second.messages as Array<{ role: string; content: string }>).map((m) => m.content)).toEqual([
      "one",
      "Hi.",
      "two",
    ]);
    expect(second.opts).toEqual({ project: "talnio", mode: "recruiter" });
    expect(calls[0]!.opts).toEqual({ project: undefined, mode: undefined });
  });

  it("repairs model spellings as they stream (【1】 becomes [1])", async () => {
    const { store } = make([
      { t: "meta", mode: "ai", sources: [] },
      { t: "text", d: "Real" },
      { t: "text", d: "‑time 【" },
      { t: "text", d: "1】." },
      { t: "done" },
    ]);
    await store.send("q");
    expect(last(store.getState()).text).toBe("Real-time [1].");
  });

  it("ignores empty input, input over the limit, and a second question while one is running", async () => {
    const { store, streamChat } = make();
    await store.send("   ");
    await store.send("a".repeat(LIMITS.chatInputChars + 1));
    expect(streamChat).not.toHaveBeenCalled();
    let release: () => void = () => {};
    const slow = make(async () => new Promise<never>((_, rej) => (release = () => rej(new Error("x")))));
    const first = slow.store.send("first");
    await slow.store.send("second");
    expect(slow.streamChat).toHaveBeenCalledTimes(1);
    release();
    await first;
  });

  it("lets a pasted job description be longer than a normal message", async () => {
    const { store, streamChat } = make();
    const jd =
      "Responsibilities: build APIs. Requirements: Java, Spring Boot, 3+ years of experience. ".repeat(20);
    expect(jd.length).toBeGreaterThan(LIMITS.chatInputChars);
    await store.send(jd);
    expect(streamChat).toHaveBeenCalledTimes(1);
  });

  it("explains failures in plain words", async () => {
    const busy = make(async () => Promise.reject(new ChatHttpError(429, 150)));
    await busy.store.send("q");
    expect(last(busy.store.getState()).error).toContain("about 3 minutes");

    const bad = make(async () => Promise.reject(new ChatHttpError(400)));
    await bad.store.send("q");
    expect(last(bad.store.getState()).error).toContain("1,000 characters");

    const down = make(async () => Promise.reject(new TypeError("fetch failed")));
    await down.store.send("q");
    expect(last(down.store.getState()).error).toBe(
      "Couldn't reach GRID. Check your connection and try again.",
    );
    expect(down.store.getState().busy).toBe(false);
  });

  it("Stop ends the turn and says so; whatever had arrived stays", async () => {
    const abortable = make(async () => Promise.reject(Object.assign(new Error("a"), { name: "AbortError" })));
    await abortable.store.send("q");
    expect(last(abortable.store.getState()).error).toBe("Stopped before an answer arrived.");
  });
});

describe("GRID store: memory", () => {
  it("is saved, and a fresh store loads it without redoing what the cards did", async () => {
    const a = make([
      { t: "meta", mode: "ai", sources: [] },
      { t: "tool", id: "c1", name: "navigate", state: "running" },
      { t: "part", id: "c1", part: card },
      { t: "text", d: "Taking you there." },
      { t: "done" },
    ]);
    await a.store.send("take me to contact");
    a.store.flush();
    expect(a.storage.data.get(STORAGE_KEY)).toBeTruthy();

    const b = make();
    const again = createGridStore({
      storage: () => a.storage,
      act: b.act,
      track: b.track,
      streamChat: b.streamChat as never,
    });
    again.hydrate();
    const s = again.getState();
    expect(s.messages.map((m) => m.text)).toEqual(["take me to contact", "Taking you there."]);
    expect(last(s).parts.map((p) => p.part.kind)).toEqual(["navigate"]);
    expect(last(s).tools).toEqual([]); // transient
    expect(b.act).not.toHaveBeenCalled(); // coming back must not navigate you again
  });

  it("keeps the mode and falls back to the default for one it does not know", () => {
    const storage = memory();
    storage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, mode: "recruiter", messages: [] }));
    const ok = createGridStore({ storage: () => storage });
    ok.hydrate();
    expect(ok.getState().mode).toBe("recruiter");
    storage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, mode: "root", messages: [] }));
    const bad = createGridStore({ storage: () => storage });
    bad.hydrate();
    expect(bad.getState().mode).toBe("default");
  });

  it("drops anything in storage that is not a message, and a card of an unknown shape", () => {
    const storage = memory();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: 1,
        messages: [
          { role: "user", text: "hi", sources: [], parts: [], tools: [], followups: [] },
          { role: "root", text: "x" },
          "junk",
          {
            role: "assistant",
            text: "ok",
            sources: [],
            parts: [
              { id: "1", part: { kind: "iframe", src: "https://evil.example" } },
              { id: "2", part: card },
            ],
            tools: [],
            followups: [],
          },
        ],
      }),
    );
    const store = createGridStore({ storage: () => storage });
    store.hydrate();
    expect(store.getState().messages).toHaveLength(2);
    expect(last(store.getState()).parts.map((p) => p.part.kind)).toEqual(["navigate"]);
  });

  it.each([
    ["corrupt JSON", "{not json"],
    ["a different version", JSON.stringify({ v: 2, messages: [] })],
    ["not an object", "42"],
  ])("starts fresh from %s", (_n, raw) => {
    const storage = memory();
    storage.setItem(STORAGE_KEY, raw);
    const store = createGridStore({ storage: () => storage });
    store.hydrate();
    expect(store.getState().messages).toEqual([]);
  });

  it("works with storage that is missing, blocked or full", async () => {
    const none = createGridStore({
      storage: () => null,
      streamChat: make().streamChat as never,
      act: vi.fn(),
      track: vi.fn(),
    });
    await none.send("q");
    none.flush();
    expect(none.getState().messages).toHaveLength(2);

    const full = createGridStore({
      storage: () => ({
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("quota");
        },
        removeItem: () => {
          throw new Error("blocked");
        },
      }),
      streamChat: make().streamChat as never,
      act: vi.fn(),
      track: vi.fn(),
    });
    full.hydrate();
    await full.send("q");
    expect(() => full.flush()).not.toThrow();
    expect(() => full.reset()).not.toThrow();
    expect(full.getState().messages).toEqual([]);
  });

  it("keeps only the newest messages and stays under its size cap", async () => {
    const big = make([
      { t: "meta", mode: "ai", sources: [] },
      { t: "text", d: "x".repeat(40_000) },
      { t: "done" },
    ]);
    for (let i = 0; i < 8; i++) await big.store.send(`q${i}`);
    big.store.flush();
    const saved = big.storage.data.get(STORAGE_KEY)!;
    expect(saved.length).toBeLessThanOrEqual(150_000);
    const parsed = JSON.parse(saved) as { messages: Array<{ text: string }> };
    expect(parsed.messages.at(-1)!.text.startsWith("x")).toBe(true); // newest kept
    expect(parsed.messages.length).toBeLessThan(16);
  });

  it("New chat clears the conversation and what was saved", async () => {
    const { store, storage } = make();
    await store.send("q");
    store.flush();
    store.reset();
    expect(store.getState().messages).toEqual([]);
    expect(storage.data.has(STORAGE_KEY)).toBe(false);
  });
});

describe("GRID store: language and decisions", () => {
  it("sends the chosen language with each question, and nothing for auto", async () => {
    const { store, calls } = make();
    await store.send("one");
    store.setLang("kn");
    await store.send("two");
    expect(calls[0]!.opts).toMatchObject({ lang: undefined });
    expect(calls[1]!.opts).toMatchObject({ lang: "kn" });
  });

  it("remembers the language across a reload, and ignores one it does not know", () => {
    const storage = memory();
    storage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, mode: "default", lang: "hi", messages: [] }));
    const ok = createGridStore({ storage: () => storage });
    ok.hydrate();
    expect(ok.getState().lang).toBe("hi");
    storage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, lang: "klingon", messages: [] }));
    const bad = createGridStore({ storage: () => storage });
    bad.hydrate();
    expect(bad.getState().lang).toBe("auto");
  });

  it("a message card stays sent or cancelled after a reload, so it is not offered twice", async () => {
    const confirm: UiPart = {
      kind: "confirm",
      action: "send_message",
      name: "",
      email: "",
      company: "",
      role: "",
      message: "hi there you",
      mailto: "a@b.co",
    };
    const a = make([
      { t: "meta", mode: "ai", sources: [] },
      { t: "tool", id: "c1", name: "send_message_to_vishal", state: "running" },
      { t: "part", id: "c1", part: confirm },
      { t: "text", d: "Please check it." },
      { t: "done" },
    ]);
    await a.store.send("message him");
    const bot = a.store.getState().messages.at(-1)!;
    a.store.resolvePart(bot.id, "c1", "sent");
    expect(a.store.getState().messages.at(-1)!.parts[0]!.done).toBe("sent");
    a.store.flush();
    const again = createGridStore({ storage: () => a.storage });
    again.hydrate();
    expect(again.getState().messages.at(-1)!.parts[0]!.done).toBe("sent");
    // anything else in that field is dropped
    const raw = JSON.parse(a.storage.data.get(STORAGE_KEY)!);
    raw.messages.at(-1).parts[0].done = "hacked";
    a.storage.data.set(STORAGE_KEY, JSON.stringify(raw));
    const third = createGridStore({ storage: () => a.storage });
    third.hydrate();
    expect(third.getState().messages.at(-1)!.parts[0]!.done).toBeUndefined();
  });
});

describe("GRID store: modes and status", () => {
  it("counts a mode change once and ignores choosing the same mode again", () => {
    const { store, track } = make();
    store.setMode("engineer");
    store.setMode("engineer");
    expect(track.mock.calls.filter((c) => c[0] === "grid_mode")).toEqual([
      ["grid_mode", { mode: "engineer" }],
    ]);
  });

  it("asks once whether the model is online; a failed check means offline", async () => {
    const fetchStatus = vi.fn(async () => true);
    const store = createGridStore({ storage: () => null, fetchStatus });
    await store.checkAi();
    await store.checkAi();
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    expect(store.getState().ai).toBe(true);
    const down = createGridStore({
      storage: () => null,
      fetchStatus: async () => Promise.reject(new Error("x")),
    });
    await down.checkAi();
    expect(down.getState().ai).toBe(false);
  });

  it("subscribers hear about every change, and can stop listening", async () => {
    const { store } = make();
    const seen = vi.fn();
    const off = store.subscribe(seen);
    await store.send("q");
    expect(seen).toHaveBeenCalled();
    const n = seen.mock.calls.length;
    off();
    store.setMode("recruiter");
    expect(seen.mock.calls.length).toBe(n);
  });
});
