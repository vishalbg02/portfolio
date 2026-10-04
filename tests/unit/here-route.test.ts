import { beforeEach, describe, expect, it, vi } from "vitest";

/** /api/here: the visitor wall's heartbeat. It must never answer with an error status for a visitor who did nothing wrong. */
async function post(body: unknown, ip = "1.2.3.4", origin?: string) {
  const { POST } = await import("@/app/api/here/route");
  return POST(
    new Request("http://localhost/api/here", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip, ...(origin ? { origin } : {}) },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/here", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const k of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) vi.stubEnv(k, "");
  });

  it("answers dim (not configured) without Redis, and rejects a bad id or another origin", async () => {
    const ok = await post({ v: "abcdefghij12" });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ configured: false, count: 0, cells: [] });
    expect((await post({ v: "no" })).status).toBe(400);
    expect((await post({ v: "abcdefghij12" }, "1.2.3.4", "https://evil.example")).status).toBe(403);
  });

  it("allows 20 a minute per address; past that it says 'not counted' (202), never an error status", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++) statuses.push((await post({ v: "abcdefghij12" }, "8.8.8.8")).status);
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(20)).toEqual([202, 202]);
    const blocked = await post({ v: "abcdefghij12" }, "8.8.8.8");
    expect(await blocked.json()).toEqual({ throttled: true });
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    // another address is unaffected
    expect((await post({ v: "abcdefghij12" }, "9.9.9.9")).status).toBe(200);
  });
});
