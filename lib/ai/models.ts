/**
 * The ONLY place model IDs live. Verified 2026-10-03 against Google's models page
 * (https://ai.google.dev/gemini-api/docs/models): all three are stable (GA), not preview.
 * Google retires models — re-check before launch and whenever the build starts failing.
 */
export const MODELS = {
  /** Chat answers: the cheapest stable Flash variant is plenty for short, grounded answers. */
  chat: "gemini-3.5-flash-lite",
  /** Job-description requirement extraction (structured output). */
  match: "gemini-3.5-flash-lite",
  /** Text embeddings (stable). `gemini-embedding-2` is still preview. */
  embedding: "gemini-embedding-001",
} as const;

/** 768 is a supported size for gemini-embedding-001 and keeps generated/embeddings.json small. */
export const EMBEDDING_DIMS = 768;
