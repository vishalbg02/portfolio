import "server-only";
import { embed } from "ai";
import { retrievalQuery } from "../guards";
import { LIMITS } from "../limits";
import type { ChatMessage } from "../protocol";
import { getProvider } from "../provider";
import { RELEVANCE_MIN, type RetrievalResult } from "@/lib/rag/retrieve";
import { scopeResults } from "@/lib/rag/scope";
import { getRetriever } from "@/lib/rag/store";
import type { ProjectSlug } from "@/lib/content/profile-schema";

/** Embeds the question for hybrid retrieval. Any failure just means keyword-only retrieval. */
export async function embedQuery(query: string): Promise<number[] | null> {
  const provider = getProvider();
  const retriever = getRetriever();
  const model = provider?.embeddingModel();
  if (!provider || !model || !retriever.hasVectors) return null;
  try {
    const { embedding } = await embed({
      model,
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

/** Hybrid retrieval for the newest question (a short follow-up borrows the previous one), scoped to a project if asked. */
export async function retrieveFor(messages: ChatMessage[], project?: ProjectSlug): Promise<RetrievalResult> {
  const retriever = getRetriever();
  const query = retrievalQuery(messages);
  const found = retriever.retrieve(query, LIMITS.retrievalK, await embedQuery(query));
  return project ? { ...found, results: scopeResults(found.results, project, retriever.chunkList()) } : found;
}

export { RELEVANCE_MIN };

/** Which chunks a `scope` of search_profile may return. */
export const SCOPES = ["all", "projects", "experience", "skills", "education", "awards", "contact"] as const;
export type Scope = (typeof SCOPES)[number];

const SCOPE_TEST: Record<Exclude<Scope, "all">, (id: string) => boolean> = {
  projects: (id) => id.startsWith("project-") || id.startsWith("case-"),
  experience: (id) => id.startsWith("experience-") || id === "employers",
  skills: (id) => id.startsWith("skills-") || id === "strengths",
  education: (id) => id === "education" || id === "certifications",
  awards: (id) => id === "recognition",
  contact: (id) => id === "contact" || id === "preferences" || id === "status",
};

export const inScope = (id: string, scope: Scope) => scope === "all" || SCOPE_TEST[scope](id);
