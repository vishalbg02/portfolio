import { APICallError } from "ai";

/**
 * Which model route to try first. A route that just failed is not tried first again for a while, so the
 * questions that follow a quota error don't each wait for the same failure. Module state: per server
 * instance, which is fine (it is only an optimisation; the order of routes is the real policy).
 */
export type NamedRoute = { name: string };

const until = new Map<string, number>();

const COOLDOWN_MS = { rateLimited: 60_000, outage: 20_000, rejected: 10 * 60_000 } as const;

/** The HTTP status behind an error, looking through retry wrappers (`lastError`) and `cause`. */
export function statusOf(err: unknown): number | null {
  for (let e: unknown = err, depth = 0; e && depth < 4; depth++) {
    if (APICallError.isInstance(e) && typeof e.statusCode === "number") return e.statusCode;
    const next =
      (e as { lastError?: unknown; cause?: unknown }).lastError ?? (e as { cause?: unknown }).cause;
    e = next;
  }
  return null;
}

function retryAfterMs(err: unknown): number | null {
  for (let e: unknown = err, depth = 0; e && depth < 4; depth++) {
    if (APICallError.isInstance(e)) {
      const raw = e.responseHeaders?.["retry-after"];
      const sec = raw ? Number(raw) : NaN;
      return Number.isFinite(sec) && sec > 0 ? Math.min(sec, 300) * 1000 : null;
    }
    e = (e as { lastError?: unknown; cause?: unknown }).lastError ?? (e as { cause?: unknown }).cause;
  }
  return null;
}

/** Routes that are not cooling down first, in their original order; the cooling ones keep their order after. */
export function orderRoutes<T extends NamedRoute>(routes: T[], now = Date.now()): T[] {
  const cooling = (r: T) => (until.get(r.name) ?? 0) > now;
  return [...routes.filter((r) => !cooling(r)), ...routes.filter(cooling)];
}

export function markFailed(name: string, err: unknown, now = Date.now()) {
  const status = statusOf(err);
  const wait =
    status === 429
      ? (retryAfterMs(err) ?? COOLDOWN_MS.rateLimited)
      : status === 401 || status === 403 || status === 404
        ? COOLDOWN_MS.rejected // a bad key or a retired model will not fix itself in a minute
        : COOLDOWN_MS.outage;
  until.set(name, now + wait);
}

export const markOk = (name: string) => void until.delete(name);

/** Tests: forget every cooldown. */
export const resetRoutes = () => until.clear();
