import type { StatusState } from "./types";

/** Above this round-trip a reachable site is reported as degraded. */
export const SLOW_MS = 1500;
export const TIMEOUT_MS = 4000;

/** The two response headers that decide whether the page may be framed (see frame.ts). */
export type FrameHeaders = { "x-frame-options": string | null; "content-security-policy": string | null };

export type PingResult =
  | { ok: true; status: number; latencyMs: number; frame?: FrameHeaders }
  | { ok: false; error: "timeout" | "network" };

/**
 * Pure classifier for a probe result.
 * - network failure / timeout          → offline
 * - 502, 503, 504                      → offline (gateway/service down)
 * - other 5xx, 404/410, slow responses → degraded
 * - 401/403/405/429                    → reachable (bot walls & blocked HEAD still mean the site is up)
 * - 2xx/3xx under SLOW_MS              → live
 */
export function classify(result: PingResult): StatusState {
  if (!result.ok) return "offline";
  const { status, latencyMs } = result;
  if (status === 502 || status === 503 || status === 504) return "offline";
  if (status >= 500) return "degraded";
  if (status === 404 || status === 410) return "degraded";
  if (latencyMs >= SLOW_MS) return "degraded";
  return "live";
}
