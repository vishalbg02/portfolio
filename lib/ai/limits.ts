/** Hard limits for the AI features. Cost and abuse guards live here, in one place. */
export const LIMITS = {
  chatInputChars: 1_000,
  jdInputChars: 6_000,
  /** Only this many most-recent messages are ever sent to the model. */
  historyTurns: 6,
  /** Assistant messages come back from the client, so cap them too. */
  historyAssistantChars: 1_200,
  chatMaxOutputTokens: 400,
  /** The tool loop: at most this many model calls for one question. */
  maxSteps: 5,
  /** The whole question, tools and any fallback between providers included. */
  agentTimeoutMs: 25_000,
  /** A provider that shows nothing (no text, no tool call) in this long is given up on for the next one. */
  firstTokenMs: 8_000,
  /** Groq's reasoning models spend output tokens on thinking first; this is added to the answer cap. */
  reasoningHeadroom: 700,
  /** One tool call (the job matcher is the slowest: it may call the model once). */
  toolTimeoutMs: 12_000,
  matchMaxOutputTokens: 1_200,
  requestTimeoutMs: 20_000,
  embedTimeoutMs: 4_000,
  /** Per client (anonymous hash): 20 questions / 10 minutes. */
  chatRate: { limit: 20, windowSec: 600 },
  matchRate: { limit: 6, windowSec: 600 },
  retrievalK: 5,
  bodyBytes: 24_000,
} as const;

/** Global requests/day that may reach a paid model (chat + match combined). Override with AI_DAILY_LIMIT. */
export const DEFAULT_DAILY_LIMIT = 400;
