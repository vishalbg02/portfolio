import { simulateReadableStream } from "ai";
import { MockEmbeddingModelV4, MockLanguageModelV4 } from "ai/test";
import { vi } from "vitest";
import type { AiProvider } from "@/lib/ai/provider";
import { EventParser, type ChatEvent } from "@/lib/ai/protocol";

const usage = {
  inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 10, text: 10, reasoning: undefined },
};
const finish = {
  type: "finish" as const,
  finishReason: { unified: "stop" as const, raw: undefined },
  logprobs: undefined,
  usage,
};

/** A language model that streams `parts` as text deltas. Records every call in `.doStreamCalls`. */
export function streamingModel(parts: string[]) {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "text-start", id: "t" },
          ...parts.map((delta) => ({ type: "text-delta" as const, id: "t", delta })),
          { type: "text-end", id: "t" },
          finish,
        ],
      }),
    }),
  });
}

/** Fails before producing any text. */
export const failingModel = () =>
  new MockLanguageModelV4({
    doStream: async () => {
      throw new Error("model exploded");
    },
    doGenerate: async () => {
      throw new Error("model exploded");
    },
  });

/** Streams some text, then errors mid-stream. */
export const interruptedModel = (first: string) =>
  new MockLanguageModelV4({
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "text-start", id: "t" });
          controller.enqueue({ type: "text-delta", id: "t", delta: first });
          setTimeout(() => controller.error(new Error("connection reset")), 5);
        },
      }),
    }),
  });

/** A model whose generateText returns `json` as text (for Output.object). */
export const jsonModel = (json: unknown) =>
  new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(json) }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });

export function mockProvider(chat: MockLanguageModelV4, match: MockLanguageModelV4 = chat): AiProvider {
  return {
    chatModel: () => chat,
    matchModel: () => match,
    embeddingModel: () =>
      new MockEmbeddingModelV4({
        doEmbed: async () => ({ embeddings: [Array(768).fill(0.01)], warnings: [] }),
      }),
    embeddingOptions: () => ({}),
  };
}

export const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost:3000${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:3000", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

export async function readEvents(res: Response): Promise<ChatEvent[]> {
  const parser = new EventParser();
  return parser.push(await res.text());
}

export const textOf = (events: ChatEvent[]) => events.flatMap((e) => (e.t === "text" ? [e.d] : [])).join("");
export const metaOf = (events: ChatEvent[]) =>
  events.find((e): e is Extract<ChatEvent, { t: "meta" }> => e.t === "meta")!;

export const spyOn = (model: MockLanguageModelV4) => vi.spyOn(model, "doStream");
