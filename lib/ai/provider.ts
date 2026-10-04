import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { EmbeddingModel, LanguageModel } from "ai";
import { env } from "@/lib/env";
import { LIMITS } from "./limits";
import { EMBEDDING_DIMS, MODELS } from "./models";

/** One way to reach a model. `name` is stable (it keys cooldowns and logs); it is never shown to visitors. */
export type Route = {
  name: string;
  model: LanguageModel;
  /** Extra output tokens this route needs (reasoning models think before they answer). */
  extraOutputTokens?: number;
  providerOptions?: Record<string, Record<string, string | number | boolean>>;
};

/**
 * Everything the app needs from the AI vendors. Callers get an ORDERED list of routes and use the next one
 * when a route fails before it produced anything. Routes depend on this interface, never on a vendor SDK,
 * so tests inject a mock in one function.
 */
export interface AiProvider {
  chatRoutes(): Route[];
  matchRoutes(): Route[];
  /** null when no embedding vendor is configured → keyword retrieval. */
  embeddingModel(): EmbeddingModel | null;
  /** Provider-specific options for embedding queries / documents. */
  embeddingOptions(kind: "query" | "document"): Record<string, Record<string, string | number>>;
}

type Keys = { gemini?: string; groq?: string };

export function createProvider({ gemini, groq }: Keys): AiProvider | null {
  if (!gemini && !groq) return null;
  const google = gemini ? createGoogleGenerativeAI({ apiKey: gemini }) : null;
  const groqAi = groq ? createGroq({ apiKey: groq }) : null;
  // "low" keeps answers quick; the headroom covers the thinking tokens that count against the cap.
  const groqRoute = (name: string, id: string): Route => ({
    name,
    model: groqAi!.languageModel(id),
    extraOutputTokens: LIMITS.reasoningHeadroom,
    providerOptions: { groq: { reasoningEffort: "low" } },
  });
  return {
    chatRoutes: () => [
      ...(google ? [{ name: "gemini", model: google.chat(MODELS.chat) }] : []),
      ...(groqAi
        ? [groqRoute("groq-120b", MODELS.groqChat), groqRoute("groq-20b", MODELS.groqChatSmall)]
        : []),
    ],
    matchRoutes: () => [
      ...(google ? [{ name: "gemini", model: google.chat(MODELS.match) }] : []),
      ...(groqAi ? [groqRoute("groq-120b", MODELS.groqMatch)] : []),
    ],
    embeddingModel: () => (google ? google.embedding(MODELS.embedding) : null),
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
  return createProvider({ gemini: env.GEMINI_API_KEY, groq: env.GROQ_API_KEY });
}
