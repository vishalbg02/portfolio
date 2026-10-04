/**
 * The ONLY place model IDs live. Gemini IDs verified 2026-10-03 against Google's models page
 * (https://ai.google.dev/gemini-api/docs/models): all three are stable (GA), not preview.
 * Google retires models — re-check before launch and whenever the build starts failing.
 */
export const MODELS = {
  /** Chat answers: the cheapest stable Flash variant is plenty for short, grounded answers. */
  chat: "gemini-3.5-flash-lite",
  /** Job-description requirement extraction (structured output). */
  match: "gemini-3.5-flash-lite",
  /**
   * Fallback routes on Groq (listed by its /models API on 2026-10-04). Tried in this order when Gemini is out of
   * quota or erroring; each Groq model has its own rate-limit bucket, so a limit on one does not block the next.
   */
  groqChat: "openai/gpt-oss-120b",
  groqChatSmall: "openai/gpt-oss-20b",
  groqMatch: "openai/gpt-oss-120b",
  /** Text embeddings (stable). `gemini-embedding-2` is still preview. Groq has no embeddings: keyword search then. */
  embedding: "gemini-embedding-001",
} as const;

/** 768 is a supported size for gemini-embedding-001 and keeps generated/embeddings.json small. */
export const EMBEDDING_DIMS = 768;
