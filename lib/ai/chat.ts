import "server-only";
import { embed, streamText } from "ai";
import { consumeDaily } from "./budget";
import { retrievalQuery } from "./guards";
import { LIMITS } from "./limits";
import { REFUSAL_TEXT, offlineAnswer, toSources } from "./offline";
import { chatInstructions } from "./prompts";
import { getProvider } from "./provider";
import type { ChatEvent, ChatMessage, OfflineReason } from "./protocol";
import { RELEVANCE_MIN, type RetrievalResult } from "@/lib/rag/retrieve";
import { scopeResults } from "@/lib/rag/scope";
import { getRetriever } from "@/lib/rag/store";
import type { ProjectSlug } from "@/lib/content/profile-schema";

/** Embeds the question for hybrid retrieval. Any failure just means keyword-only retrieval. */
async function embedQuery(query: string): Promise<number[] | null> {
  const provider = getProvider();
  const retriever = getRetriever();
  if (!provider || !retriever.hasVectors) return null;
  try {
    const { embedding } = await embed({
      model: provider.embeddingModel(),
      value: query,
      providerOptions: provider.embeddingOptions("query"),
      abortSignal: AbortSignal.timeout(LIMITS.embedTimeoutMs),
    });
    return embedding;
  } catch (err) {
    console.error("[ai] query embedding failed, using keyword retrieval:", (err as Error).message);
    return null;
  }
}

const log = (fields: Record<string, string | number | boolean>) =>
  console.info("[ai]", JSON.stringify({ route: "chat", ...fields }));

async function* textAsEvents(text: string): AsyncGenerator<ChatEvent> {
  // a few words at a time so the offline answer streams like the real one
  for (const part of text.match(/\S+\s*/g) ?? []) yield { t: "text", d: part };
}

async function* offlineEvents(retrieval: RetrievalResult, reason: OfflineReason): AsyncGenerator<ChatEvent> {
  const { text, sources } = offlineAnswer(retrieval.results, reason);
  yield { t: "meta", mode: "offline", sources, reason };
  yield* textAsEvents(text);
  yield { t: "done" };
}

/**
 * Produces the answer as protocol events. Order of decisions (cheapest first):
 *  1. unrelated/unknown topic → canned refusal, NO model call
 *  2. no API key, or daily budget spent → deterministic offline answer
 *  3. otherwise stream the model; if it fails before the first token, fall back to offline
 */
export async function* chatEvents(
  messages: ChatMessage[],
  opts: { project?: ProjectSlug } = {},
): AsyncGenerator<ChatEvent> {
  const retriever = getRetriever();
  const query = retrievalQuery(messages);
  const found = retriever.retrieve(query, LIMITS.retrievalK, await embedQuery(query));
  const retrieval = opts.project
    ? { ...found, results: scopeResults(found.results, opts.project, retriever.chunkList()) }
    : found;

  if (retrieval.coverage < RELEVANCE_MIN) {
    log({ mode: "refusal", coverage: +retrieval.coverage.toFixed(2), retrieval: retrieval.mode });
    yield { t: "meta", mode: "refusal", sources: [], reason: "off_topic" };
    yield* textAsEvents(REFUSAL_TEXT);
    yield { t: "done" };
    return;
  }

  const provider = getProvider();
  if (!provider) {
    log({ mode: "offline", reason: "no_key" });
    yield* offlineEvents(retrieval, "no_key");
    return;
  }
  const budget = await consumeDaily();
  if (!budget.ok) {
    log({ mode: "offline", reason: "budget", used: budget.used });
    yield* offlineEvents(retrieval, "budget");
    return;
  }

  let failure: unknown = null;
  const result = streamText({
    model: provider.chatModel(),
    instructions: chatInstructions(retrieval.results),
    messages,
    maxOutputTokens: LIMITS.chatMaxOutputTokens,
    temperature: 0.2,
    abortSignal: AbortSignal.timeout(LIMITS.requestTimeoutMs),
    // One retry, not the default two: a quota/overload error should reach the offline answer quickly.
    maxRetries: 1,
    onError: ({ error }) => {
      failure = error;
    },
  });

  const iterator = result.textStream[Symbol.asyncIterator]();
  let first: IteratorResult<string>;
  try {
    first = await iterator.next();
  } catch (err) {
    failure = err;
    first = { done: true, value: undefined };
  }
  if (failure || first.done || !first.value?.trim()) {
    log({ mode: "offline", reason: "error", retrieval: retrieval.mode });
    if (failure)
      console.error("[ai] model failed before the first token:", (failure as Error).message ?? "unknown");
    yield* offlineEvents(retrieval, "error");
    return;
  }

  log({ mode: "ai", retrieval: retrieval.mode, coverage: +retrieval.coverage.toFixed(2) });
  yield { t: "meta", mode: "ai", sources: toSources(retrieval.results) };
  yield { t: "text", d: first.value };
  try {
    for (let next = await iterator.next(); !next.done; next = await iterator.next())
      yield { t: "text", d: next.value };
    if (failure) throw failure;
    yield { t: "done" };
  } catch (err) {
    console.error("[ai] stream interrupted:", (err as Error).message ?? "unknown");
    yield { t: "error", message: "The answer was cut off. Please try again." };
  }
}
