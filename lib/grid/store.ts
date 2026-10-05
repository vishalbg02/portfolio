import { ChatHttpError, streamChat as realStreamChat } from "@/lib/ai/client";
import { inputLimit } from "@/lib/ai/agent/jd";
import { isLang, type Lang } from "@/lib/ai/lang";
import { isMode, type GridMode } from "@/lib/ai/modes";
import { normalizeModelText } from "@/lib/ai/sanitize";
import {
  isUiPart,
  type ChatEvent,
  type ChatMessage,
  type ChatMode,
  type OfflineReason,
  type Source,
  type ToolName,
  type UiPart,
} from "@/lib/ai/protocol";
import { unlock } from "@/lib/achievements";
import { track as realTrack } from "@/lib/analytics";
import { ACT_EVENT } from "@/lib/grid/events";
import { emitStage } from "@/lib/grid/stages";

/**
 * GRID's conversation, outside React: one store that the side sheet, the full-screen sheet and the inline
 * chat on the page all read, so they always show the same conversation. It streams from /api/chat, keeps the
 * last messages in localStorage (every access in try/catch: private windows, blocked storage), and tells the
 * page when a card asks for something to happen (navigate, play a demo). No message text ever goes to analytics.
 */
/** `done`: what the visitor did with a card that asks for a decision (a message to send), so it is not offered again. */
export type PartItem = { id: string; part: UiPart; done?: "sent" | "cancelled" };
export type ToolPill = { id: string; name: ToolName; state: "running" | "done" | "error" };

export type Msg = {
  id: number;
  role: "user" | "assistant";
  text: string;
  sources: Source[];
  parts: PartItem[];
  tools: ToolPill[];
  followups: string[];
  mode?: ChatMode;
  reason?: OfflineReason;
  pending?: boolean;
  error?: string;
};

export type GridState = {
  messages: Msg[];
  mode: GridMode;
  lang: Lang;
  busy: boolean;
  /** null until /api/chat has been asked whether the model is online. */
  ai: boolean | null;
};

export const STORAGE_KEY = "grid:v1";
const MAX_SAVED = 30;
const MAX_BYTES = 150_000;
/** The usual limit; a pasted job description may be longer (see `inputLimit`). */
export const MAX_INPUT = 1000;
export { ACT_EVENT };

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
type Deps = {
  streamChat: typeof realStreamChat;
  storage: () => Storage | null;
  /** Called with a part that must DO something (navigate, play a demo) the moment it arrives live. */
  act: (part: UiPart) => void;
  track: typeof realTrack;
  fetchStatus: () => Promise<boolean>;
};

const browserStorage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

const EMPTY: GridState = { messages: [], mode: "default", lang: "auto", busy: false, ai: null };

export function createGridStore(deps: Partial<Deps> = {}) {
  const d: Deps = {
    streamChat: realStreamChat,
    storage: browserStorage,
    act: (part) => {
      if (typeof window !== "undefined")
        window.dispatchEvent(new CustomEvent(ACT_EVENT, { detail: { part } }));
    },
    track: realTrack,
    fetchStatus: async () => {
      const j = (await (await fetch("/api/chat")).json()) as { ai?: boolean };
      return Boolean(j.ai);
    },
    ...deps,
  };

  let state: GridState = EMPTY;
  const listeners = new Set<() => void>();
  let abort: AbortController | null = null;
  let nextId = 1;
  let hydrated = false;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const set = (next: Partial<GridState>) => {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
    schedule();
  };
  const patch = (id: number, fn: (m: Msg) => Msg) =>
    set({ messages: state.messages.map((m) => (m.id === id ? fn(m) : m)) });

  /* ── persistence ───────────────────────────────────────────────────────────────────────────── */
  function schedule() {
    if (!hydrated) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 250);
  }
  function save() {
    const storage = d.storage();
    if (!storage) return;
    try {
      let msgs = state.messages.filter((m) => !m.pending).slice(-MAX_SAVED);
      let json = JSON.stringify({ v: 1, mode: state.mode, lang: state.lang, messages: msgs });
      while (json.length > MAX_BYTES && msgs.length > 2) {
        msgs = msgs.slice(2);
        json = JSON.stringify({ v: 1, mode: state.mode, lang: state.lang, messages: msgs });
      }
      storage.setItem(STORAGE_KEY, json);
    } catch {
      /* storage full or blocked: the conversation just isn't remembered */
    }
  }
  const sane = (m: unknown): m is Msg =>
    typeof m === "object" &&
    m !== null &&
    ((m as Msg).role === "user" || (m as Msg).role === "assistant") &&
    typeof (m as Msg).text === "string" &&
    Array.isArray((m as Msg).sources) &&
    Array.isArray((m as Msg).parts);

  /** Loads the saved conversation once. Safe to call repeatedly. */
  function hydrate() {
    if (hydrated) return;
    hydrated = true;
    const storage = d.storage();
    if (!storage) return;
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { v?: number; mode?: unknown; lang?: unknown; messages?: unknown[] };
      if (saved.v !== 1 || !Array.isArray(saved.messages)) return;
      const messages = saved.messages.filter(sane).map((m, i) => ({
        ...m,
        id: i + 1,
        pending: false,
        tools: [],
        parts: m.parts
          .filter((p) => isUiPart(p?.part))
          .map((p) => ({ ...p, done: p.done === "sent" || p.done === "cancelled" ? p.done : undefined })),
        followups: Array.isArray(m.followups) ? m.followups.slice(0, 3) : [],
      }));
      nextId = messages.length + 1;
      state = {
        ...state,
        messages,
        mode: isMode(saved.mode) ? saved.mode : "default",
        lang: isLang(saved.lang) ? saved.lang : "auto",
      };
      listeners.forEach((l) => l());
    } catch {
      /* corrupt: start fresh */
    }
  }

  /* ── actions ───────────────────────────────────────────────────────────────────────────────── */
  const history = (): ChatMessage[] =>
    state.messages
      .filter((m) => !m.error && m.text.trim())
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.text }));

  async function send(raw: string, opts: { project?: string } = {}) {
    const text = raw.trim();
    if (!text || state.busy || text.length > inputLimit(text)) return;
    hydrate();
    unlock("grid");
    const userId = nextId++;
    const botId = nextId++;
    const prior = history();
    set({
      busy: true,
      messages: [
        ...state.messages,
        { id: userId, role: "user", text, sources: [], parts: [], tools: [], followups: [] },
        {
          id: botId,
          role: "assistant",
          text: "",
          sources: [],
          parts: [],
          tools: [],
          followups: [],
          pending: true,
        },
      ],
    });
    d.track("grid_question");
    emitStage({ kind: "question" });
    abort = new AbortController();
    let failed = false;

    const onEvent = (e: ChatEvent) => {
      switch (e.t) {
        case "stage":
          emitStage({ kind: "stage", s: e.s, state: e.state, n: e.n });
          break;
        case "meta":
          patch(botId, (m) => ({ ...m, mode: e.mode, reason: e.reason, sources: e.sources }));
          break;
        case "sources":
          patch(botId, (m) => ({ ...m, sources: e.sources }));
          break;
        case "tool":
          emitStage({ kind: "tool", name: e.name, state: e.state });
          if (e.state === "running") d.track("grid_tool_used", { tool: e.name });
          patch(botId, (m) => ({
            ...m,
            tools: m.tools.some((t) => t.id === e.id)
              ? m.tools.map((t) => (t.id === e.id ? { ...t, state: e.state } : t))
              : [...m.tools, { id: e.id, name: e.name, state: e.state }],
          }));
          break;
        case "part":
          if (isUiPart(e.part)) {
            patch(botId, (m) => ({ ...m, parts: [...m.parts, { id: e.id, part: e.part }] }));
            d.act(e.part);
          }
          break;
        case "text":
          patch(botId, (m) => ({ ...m, text: normalizeModelText(m.text + e.d), pending: false }));
          break;
        case "followups":
          patch(botId, (m) => ({ ...m, followups: e.items.slice(0, 3) }));
          break;
        case "error":
          failed = true;
          patch(botId, (m) => ({ ...m, error: e.message, pending: false }));
          break;
        case "done":
          patch(botId, (m) => ({ ...m, pending: false }));
          break;
      }
    };

    try {
      await d.streamChat([...prior, { role: "user", content: text }], onEvent, abort.signal, {
        // only the question asked from a project page is scoped; follow-ups search everything
        project: opts.project,
        mode: state.mode === "default" ? undefined : state.mode,
        lang: state.lang === "auto" ? undefined : state.lang,
      });
    } catch (err) {
      failed = true;
      const fail = (error: string) => patch(botId, (m) => ({ ...m, pending: false, error }));
      if ((err as Error).name === "AbortError")
        fail(
          state.messages.find((m) => m.id === botId)?.text ? "Stopped." : "Stopped before an answer arrived.",
        );
      else if (err instanceof ChatHttpError && err.status === 429) {
        const mins = Math.max(1, Math.ceil((err.retryAfterSec ?? 60) / 60));
        fail(
          `You've asked a lot of questions — please try again in about ${mins} minute${mins === 1 ? "" : "s"}, or use the contact section.`,
        );
      } else if (err instanceof ChatHttpError && err.status === 400)
        fail("That message couldn't be sent. Keep it under 1,000 characters.");
      else fail("Couldn't reach GRID. Check your connection and try again.");
    } finally {
      emitStage({ kind: "end", error: failed });
      abort = null;
      set({ busy: false, messages: state.messages.map((m) => (m.pending ? { ...m, pending: false } : m)) });
    }
  }

  // Leaving the page within the save delay (a quick reload, closing the tab) must not lose the last turn.
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const flushNow = () => {
      if (!hydrated) return;
      if (saveTimer) clearTimeout(saveTimer);
      save();
    };
    window.addEventListener("pagehide", flushNow);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushNow();
    });
  }

  return {
    subscribe(cb: () => void) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getState: () => state,
    getServerState: () => EMPTY,
    hydrate,
    send,
    stop: () => abort?.abort(),
    reset() {
      abort?.abort();
      set({ messages: [], busy: false });
      try {
        d.storage()?.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    },
    setLang(lang: Lang) {
      if (lang === state.lang) return;
      set({ lang });
    },
    /** Remembers what the visitor did with a card (sent / cancelled), so it is not offered again after a reload. */
    resolvePart(msgId: number, partId: string, done: "sent" | "cancelled") {
      patch(msgId, (m) => ({ ...m, parts: m.parts.map((p) => (p.id === partId ? { ...p, done } : p)) }));
    },
    setMode(mode: GridMode) {
      if (mode === state.mode) return;
      d.track("grid_mode", { mode });
      set({ mode });
    },
    async checkAi() {
      if (state.ai !== null) return;
      try {
        set({ ai: await d.fetchStatus() });
      } catch {
        set({ ai: false });
      }
    },
    /** Test hook: write pending saves now. */
    flush: save,
  };
}

export type GridStore = ReturnType<typeof createGridStore>;
export const gridStore: GridStore = createGridStore();
