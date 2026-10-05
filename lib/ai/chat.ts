import "server-only";
import { isStepCount, streamText } from "ai";
import { consumeDaily } from "./budget";
import { LIMITS } from "./limits";
import { isLang, type Lang } from "./lang";
import { isMode, type GridMode } from "./modes";
import { REFUSAL_TEXT, offlineAnswer } from "./offline";
import { agentInstructions } from "./prompts";
import { getProvider, type Route } from "./provider";
import { markFailed, markOk, orderRoutes, statusOf } from "./routes";
import {
  TOOL_NAMES,
  type ChatEvent,
  type ChatMessage,
  type OfflineReason,
  type ToolName,
  type UiPart,
} from "./protocol";
import { suggestFollowUps } from "./agent/followups";
import { RELEVANCE_MIN, retrieveFor } from "./agent/retrieval";
import { routeIntent, type Routed } from "./agent/router";
import { SourceRegistry } from "./agent/sources";
import { buildTools, type ToolResult } from "./agent/tools";
import type { RetrievalResult } from "@/lib/rag/retrieve";
import type { ProjectSlug } from "@/lib/content/profile-schema";

const log = (fields: Record<string, string | number | boolean>) =>
  console.info("[ai]", JSON.stringify({ route: "chat", ...fields }));

async function* textAsEvents(text: string): AsyncGenerator<ChatEvent> {
  // a few words at a time so a canned answer streams like a real one
  for (const part of text.match(/\S+\s*/g) ?? []) yield { t: "text", d: part };
}

const isToolName = (n: string): n is ToolName => (TOOL_NAMES as readonly string[]).includes(n);

async function* finish(
  question: string,
  mode: GridMode,
  sources: Routed["sources"],
  parts: UiPart[],
): AsyncGenerator<ChatEvent> {
  yield { t: "stage", s: "answer", state: "done" };
  const items = suggestFollowUps({ mode, question, sources, parts });
  if (items.length > 0) yield { t: "followups", items };
  yield { t: "done" };
}

/** A router answer: cards (as tool events), then a sentence, with no model call. */
async function* routedEvents(routed: Routed, question: string, mode: GridMode): AsyncGenerator<ChatEvent> {
  yield { t: "meta", mode: "router", sources: routed.sources };
  // the router knew the answer: no retrieval, no ranking, no model
  yield { t: "stage", s: "route", state: "done" };
  yield { t: "stage", s: "retrieve", state: "skip" };
  yield { t: "stage", s: "rank", state: "skip" };
  let i = 0;
  for (const { tool, part } of routed.parts) {
    const id = `r${++i}`;
    yield { t: "tool", id, name: tool, state: "running" };
    yield { t: "part", id, part };
    yield { t: "tool", id, name: tool, state: "done" };
  }
  yield { t: "stage", s: "answer", state: "start" };
  yield* textAsEvents(routed.text);
  yield* finish(
    question,
    mode,
    routed.sources,
    routed.parts.map((p) => p.part),
  );
}

async function* offlineEvents(
  retrieval: RetrievalResult,
  reason: OfflineReason,
  question: string,
  mode: GridMode,
): AsyncGenerator<ChatEvent> {
  const { text, sources } = offlineAnswer(retrieval.results, reason);
  yield { t: "meta", mode: "offline", sources, reason };
  yield { t: "stage", s: "answer", state: "start" };
  yield* textAsEvents(text);
  yield* finish(question, mode, sources, []);
}

/**
 * Produces GRID's answer as protocol events. Order of decisions (cheapest first):
 *  1. an obvious command ("show me Talnio", "how do I reach him", a pasted job description) → the router
 *     answers from content, NO model call
 *  2. unrelated or unknown topic → canned refusal, NO model call
 *  3. no API key, or the daily budget is spent → deterministic offline answer
 *  4. otherwise a model plans: it gets the retrieved context plus the tools, and may call up to `maxSteps`
 *     steps. Routes are tried in order; if every one fails before its first token or tool call → offline
 */
export async function* chatEvents(
  messages: ChatMessage[],
  opts: { project?: ProjectSlug; mode?: GridMode; lang?: Lang } = {},
): AsyncGenerator<ChatEvent> {
  const mode: GridMode = isMode(opts.mode) ? opts.mode : "default";
  const question = messages.filter((m) => m.role === "user").at(-1)!.content;

  const routed = await routeIntent(question, { mode });
  if (routed) {
    log({ mode: "router", tools: routed.parts.length });
    yield* routedEvents(routed, question, mode);
    return;
  }

  // not a command the router knows: search the site's content (BM25 + embeddings), then rank what came back
  yield { t: "stage", s: "route", state: "skip" };
  yield { t: "stage", s: "retrieve", state: "start" };
  const retrieval = await retrieveFor(messages, opts.project);
  yield { t: "stage", s: "retrieve", state: "done", n: retrieval.results.length };
  yield {
    t: "stage",
    s: "rank",
    state: "done",
    n: retrieval.coverage >= RELEVANCE_MIN ? retrieval.results.length : 0,
  };
  if (retrieval.coverage < RELEVANCE_MIN) {
    log({ mode: "refusal", coverage: +retrieval.coverage.toFixed(2), retrieval: retrieval.mode });
    yield { t: "meta", mode: "refusal", sources: [], reason: "off_topic" };
    yield { t: "stage", s: "answer", state: "start" };
    yield* textAsEvents(REFUSAL_TEXT);
    yield* finish(question, mode, [], []);
    return;
  }

  const provider = getProvider();
  if (!provider) {
    log({ mode: "offline", reason: "no_key" });
    yield* offlineEvents(retrieval, "no_key", question, mode);
    return;
  }
  const budget = await consumeDaily();
  if (!budget.ok) {
    log({ mode: "offline", reason: "budget", used: budget.used });
    yield* offlineEvents(retrieval, "budget", question, mode);
    return;
  }

  const registry = new SourceRegistry();
  registry.add(retrieval.results.map((r) => r.chunk));
  const instructions = agentInstructions(retrieval.results, {
    mode,
    lang: isLang(opts.lang) ? opts.lang : "auto",
  });

  const shown: UiPart[] = [];
  const toolsUsed: string[] = [];
  let sourceCount = registry.size;
  let hasText = false;

  /** Protocol events for one stream part (or none). */
  const translate = (part: { type: string; [k: string]: unknown }): ChatEvent[] => {
    if (part.type === "text-delta" && typeof part.text === "string" && part.text) {
      const first = !hasText;
      hasText = true;
      return first
        ? [
            { t: "stage", s: "answer", state: "start" },
            { t: "text", d: part.text },
          ]
        : [{ t: "text", d: part.text }];
    }
    if (part.type === "tool-call" && typeof part.toolName === "string" && isToolName(part.toolName)) {
      toolsUsed.push(part.toolName);
      return [{ t: "tool", id: String(part.toolCallId), name: part.toolName, state: "running" }];
    }
    if (part.type === "tool-error" && typeof part.toolName === "string" && isToolName(part.toolName))
      return [{ t: "tool", id: String(part.toolCallId), name: part.toolName, state: "error" }];
    if (part.type === "tool-result" && typeof part.toolName === "string" && isToolName(part.toolName)) {
      const id = String(part.toolCallId);
      const out = part.output as ToolResult | undefined;
      const events: ChatEvent[] = [];
      if (out?.part) {
        shown.push(out.part);
        events.push({ t: "part", id, part: out.part });
      }
      if (registry.size > sourceCount) {
        sourceCount = registry.size;
        events.push({ t: "sources", sources: registry.all() });
      }
      events.push({ t: "tool", id, name: part.toolName, state: out?.error ? "error" : "done" });
      return events;
    }
    return [];
  };

  // Routes in order (Gemini, then Groq's 120B, then its 20B). A route that fails before it has shown anything
  // (quota, outage, timeout, nothing but an error) hands over to the next; once something has been shown, that
  // route owns the answer. The whole question stays inside one deadline, fallbacks included.
  const deadline = AbortSignal.timeout(LIMITS.agentTimeoutMs);
  const candidates = orderRoutes(provider.chatRoutes());
  let chosen: { route: Route; iterator: AsyncIterator<unknown>; pending: ChatEvent[] } | null = null;
  for (const [i, route] of candidates.entries()) {
    const last = i === candidates.length - 1;
    const giveUp = new AbortController();
    const timer = last
      ? null
      : setTimeout(() => giveUp.abort(new Error("no output in time")), LIMITS.firstTokenMs);
    let failure: unknown = null;
    const result = streamText({
      model: route.model,
      instructions,
      messages,
      tools: buildTools({ sources: registry, visitorText: question }),
      stopWhen: isStepCount(LIMITS.maxSteps),
      maxOutputTokens: LIMITS.chatMaxOutputTokens + (route.extraOutputTokens ?? 0),
      temperature: 0.2,
      ...(route.providerOptions ? { providerOptions: route.providerOptions } : {}),
      abortSignal: AbortSignal.any([deadline, giveUp.signal]),
      // A quota/overload error should reach the next route quickly; only the last route retries once.
      maxRetries: last ? 1 : 0,
      onError: ({ error }) => {
        failure = error;
      },
    });
    const iterator = result.fullStream[Symbol.asyncIterator]();
    const pending: ChatEvent[] = [];
    try {
      // Wait for the first real output (text or a tool call) before committing to this route's answer.
      for (;;) {
        const next = await iterator.next();
        if (next.done) break;
        const part = next.value as { type: string; [k: string]: unknown };
        if (part.type === "error") throw part.error ?? new Error("model error");
        const events = translate(part);
        if (events.length > 0) {
          pending.push(...events);
          break;
        }
      }
    } catch (err) {
      failure = err;
    }
    if (timer) clearTimeout(timer);
    if (!failure && pending.length > 0) {
      markOk(route.name);
      chosen = { route, iterator, pending };
      break;
    }
    markFailed(route.name, failure ?? new Error("no output"));
    log({ route: route.name, failed: true, status: statusOf(failure) ?? 0, next: !last });
    console.error(
      `[ai] route ${route.name} failed before the first token:`,
      (failure as Error | null)?.message ?? "no output",
    );
  }

  if (!chosen) {
    log({ mode: "offline", reason: "error", retrieval: retrieval.mode });
    yield* offlineEvents(retrieval, "error", question, mode);
    return;
  }

  const { iterator, pending } = chosen;
  log({
    mode: "ai",
    route: chosen.route.name,
    retrieval: retrieval.mode,
    coverage: +retrieval.coverage.toFixed(2),
  });
  yield { t: "meta", mode: "ai", sources: registry.all() };
  yield* pending;
  try {
    for (let next = await iterator.next(); !next.done; next = await iterator.next()) {
      const part = next.value as { type: string; [k: string]: unknown };
      if (part.type === "error") throw part.error ?? new Error("model error");
      yield* translate(part);
    }
    log({ mode: "ai-done", tools: toolsUsed.length, text: hasText });
    yield* finish(question, mode, registry.all(), shown);
  } catch (err) {
    console.error("[ai] stream interrupted:", (err as Error).message ?? "unknown");
    yield { t: "error", message: "The answer was cut off. Please try again." };
  }
}
