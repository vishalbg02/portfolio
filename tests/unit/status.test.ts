import { afterEach, describe, expect, it, vi } from "vitest";
import { SLOW_MS, classify } from "@/lib/status/classify";
import { checkProject, pingUrl } from "@/lib/status/ping";

describe("status classifier", () => {
  it.each([
    [{ ok: true, status: 200, latencyMs: 142 }, "live"],
    [{ ok: true, status: 301, latencyMs: 300 }, "live"],
    [{ ok: true, status: 200, latencyMs: SLOW_MS - 1 }, "live"],
    [{ ok: true, status: 200, latencyMs: SLOW_MS }, "degraded"],
    [{ ok: true, status: 200, latencyMs: 3900 }, "degraded"],
    [{ ok: true, status: 404, latencyMs: 90 }, "degraded"],
    [{ ok: true, status: 410, latencyMs: 90 }, "degraded"],
    [{ ok: true, status: 500, latencyMs: 90 }, "degraded"],
    [{ ok: true, status: 502, latencyMs: 90 }, "offline"],
    [{ ok: true, status: 503, latencyMs: 90 }, "offline"],
    [{ ok: true, status: 504, latencyMs: 90 }, "offline"],
    // bot walls and blocked HEAD mean the site is up
    [{ ok: true, status: 401, latencyMs: 120 }, "live"],
    [{ ok: true, status: 403, latencyMs: 120 }, "live"],
    [{ ok: true, status: 405, latencyMs: 120 }, "live"],
    [{ ok: true, status: 429, latencyMs: 120 }, "live"],
    [{ ok: false, error: "timeout" }, "offline"],
    [{ ok: false, error: "network" }, "offline"],
  ] as const)("%j → %s", (result, expected) => {
    expect(classify(result)).toBe(expected);
  });
});

describe("pingUrl / checkProject", () => {
  afterEach(() => vi.unstubAllGlobals());

  const respond = (status: number) => ({ status, body: { cancel: async () => {} } }) as unknown as Response;

  it("uses HEAD and reports latency", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => respond(200));
    vi.stubGlobal("fetch", fetchMock);
    const r = await pingUrl("https://example.com");
    expect(r).toMatchObject({ ok: true, status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
    });
  });

  it("falls back to GET when HEAD is not allowed", async () => {
    const fetchMock = vi.fn(async (_u: string, init?: RequestInit) =>
      respond(init?.method === "HEAD" ? 405 : 200),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await pingUrl("https://example.com");
    expect(r).toMatchObject({ ok: true, status: 200 });
    expect(fetchMock.mock.calls.map((c) => c[1]?.method)).toEqual(["HEAD", "GET"]);
  });

  it("maps a timeout to offline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new DOMException("timed out", "TimeoutError"))),
    );
    expect(await pingUrl("https://example.com")).toEqual({ ok: false, error: "timeout" });
    const s = await checkProject("x", "https://example.com");
    expect(s).toMatchObject({ slug: "x", state: "offline", latencyMs: null });
  });

  it("maps a network failure to offline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("fetch failed"))),
    );
    expect(await pingUrl("https://example.com")).toEqual({ ok: false, error: "network" });
  });

  it("returns a null state for projects without a URL (nothing to probe)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const s = await checkProject("talnio", null);
    expect(s).toMatchObject({ slug: "talnio", state: null, latencyMs: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
