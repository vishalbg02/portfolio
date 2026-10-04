import type { LiveMessage, PresenceInfo, PresenceView } from "./types";

/** The browser's calls to the live chat API. Each resolves to a small result instead of throwing, so the UI can say what happened. */
export type SendResult =
  | { ok: true; c: string; k: string; n: number; presence: PresenceView }
  | {
      ok: false;
      reason:
        | "invalid"
        | "rate_limited"
        | "send_failed"
        | "bot_check_failed"
        | "not_configured"
        | "gone"
        | "forbidden"
        | "busy"
        | "network";
      message?: string;
    };

const reasonOf = (status: number, error?: string): Exclude<SendResult, { ok: true }>["reason"] =>
  error === "bot_check_failed"
    ? "bot_check_failed"
    : status === 429
      ? "rate_limited"
      : status === 404
        ? "gone"
        : status === 403
          ? "forbidden"
          : status === 503
            ? error === "busy"
              ? "busy"
              : "not_configured"
            : status === 502
              ? "send_failed"
              : status === 400
                ? "invalid"
                : "network";

export async function sendLive(body: Record<string, unknown>): Promise<SendResult> {
  try {
    const res = await fetch("/api/live/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      c?: string;
      k?: string;
      n?: number;
      presence?: PresenceView;
      issues?: Array<{ message: string }>;
    };
    if (res.ok && j.ok && j.c && j.k)
      return { ok: true, c: j.c, k: j.k, n: j.n ?? 0, presence: j.presence as PresenceView };
    return { ok: false, reason: reasonOf(res.status, j.error), message: j.issues?.[0]?.message };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export type PollResult =
  | { ok: true; changed: false; v: number }
  | { ok: true; changed: true; v: number; messages: LiveMessage[] }
  | { ok: false; gone: boolean };

export async function pollLive(c: string, k: string, after: number, v: number): Promise<PollResult> {
  try {
    const res = await fetch(`/api/live/poll?c=${c}&k=${encodeURIComponent(k)}&after=${after}&v=${v}`, {
      cache: "no-store",
    });
    if (res.status === 404 || res.status === 403) return { ok: false, gone: true };
    if (!res.ok) return { ok: false, gone: false };
    const j = (await res.json()) as { changed: boolean; v: number; messages?: LiveMessage[] };
    return j.changed
      ? { ok: true, changed: true, v: j.v, messages: j.messages ?? [] }
      : { ok: true, changed: false, v: j.v };
  } catch {
    return { ok: false, gone: false };
  }
}

export async function saveEmail(c: string, k: string, email: string, org: string): Promise<boolean> {
  try {
    const res = await fetch("/api/live/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ c, k, email, org: org || undefined }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

let cache: { at: number; value: PresenceInfo } | null = null;
/** Online or away. Cached for 15 seconds in the browser too. */
export async function fetchPresence(): Promise<PresenceInfo | null> {
  if (cache && Date.now() - cache.at < 15_000) return cache.value;
  try {
    const res = await fetch("/api/live/presence");
    if (!res.ok) return null;
    const value = (await res.json()) as PresenceInfo;
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return null;
  }
}
