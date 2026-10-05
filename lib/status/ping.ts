import { site } from "@/lib/site";
import { TIMEOUT_MS, classify, type PingResult } from "./classify";
import { framing } from "./frame";
import type { ProjectStatus } from "./types";

const HEADERS = { "user-agent": "vishalbg-status/1.0 (+https://vishalbg.vercel.app)" };

async function probe(url: string, method: "HEAD" | "GET"): Promise<PingResult> {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method,
      headers: HEADERS,
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // We only need the status line and two headers — don't download the body.
    void res.body?.cancel().catch(() => {});
    return {
      ok: true,
      status: res.status,
      latencyMs: Math.round(performance.now() - start),
      frame: {
        "x-frame-options": res.headers.get("x-frame-options"),
        "content-security-policy": res.headers.get("content-security-policy"),
      },
    };
  } catch (err) {
    const timedOut =
      err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError");
    return { ok: false, error: timedOut ? "timeout" : "network" };
  }
}

/** HEAD first; some hosts reject it (405/501), so fall back to GET. */
export async function pingUrl(url: string): Promise<PingResult> {
  const head = await probe(url, "HEAD");
  if (head.ok && (head.status === 405 || head.status === 501)) return probe(url, "GET");
  return head;
}

/** Only ever called with URLs from content/profile.ts — never with user input (no SSRF surface). */
export async function checkProject(slug: string, url: string | null): Promise<ProjectStatus> {
  const checkedAt = new Date().toISOString();
  if (!url) return { slug, state: null, latencyMs: null, embeddable: null, checkedAt };
  const result = await pingUrl(url);
  return {
    slug,
    state: classify(result),
    latencyMs: result.ok ? result.latencyMs : null,
    embeddable: embeddableFrom(result),
    checkedAt,
  };
}

/** Only a normal page answer (2xx/3xx) says anything about framing: a bot wall or an error page has its own headers. */
export function embeddableFrom(result: PingResult, embedder = site.url): boolean | null {
  if (!result.ok || !result.frame || result.status >= 400) return null;
  return framing({ get: (name) => result.frame![name as keyof typeof result.frame] ?? null }, embedder)
    .embeddable;
}
