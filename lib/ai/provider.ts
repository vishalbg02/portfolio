import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { EmbeddingModel, LanguageModel } from "ai";
import { env } from "@/lib/env";
import { EMBEDDING_DIMS, MODELS } from "./models";

/**
 * Everything the app needs from an AI vendor. Routes depend on this interface, never on
 * @ai-sdk/google directly, so swapping providers (or injecting a mock in tests) is one function.
 */
export interface AiProvider {
  chatModel(): LanguageModel;
  matchModel(): LanguageModel;
  embeddingModel(): EmbeddingModel;
  /** Provider-specific options for embedding queries / documents. */
  embeddingOptions(kind: "query" | "document"): Record<string, Record<string, string | number>>;
}

export function createGeminiProvider(apiKey: string): AiProvider {
  const google = createGoogleGenerativeAI({ apiKey });
  return {
    chatModel: () => google.chat(MODELS.chat),
    matchModel: () => google.chat(MODELS.match),
    embeddingModel: () => google.embedding(MODELS.embedding),
    embeddingOptions: (kind) => ({
      google: {
        outputDimensionality: EMBEDDING_DIMS,
        taskType: kind === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
      },
    }),
  };
}

let override: AiProvider | null = null;

/** Tests inject a mock provider here. */
export function setProviderForTests(p: AiProvider | null) {
  override = p;
}

/** null when no key is configured → callers use the offline (retrieval-only) mode. */
export function getProvider(): AiProvider | null {
  if (override) return override;
  return env.GEMINI_API_KEY ? createGeminiProvider(env.GEMINI_API_KEY) : null;
}
