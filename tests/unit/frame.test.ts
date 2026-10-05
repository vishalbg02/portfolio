import { describe, expect, it } from "vitest";
import { embeddableFrom } from "@/lib/status/ping";
import { framing } from "@/lib/status/frame";

const ME = "https://vishalbg.vercel.app";
const h = (headers: Record<string, string>) => ({
  get: (name: string) => headers[name.toLowerCase()] ?? null,
});

describe("framing: would a browser let this portfolio frame the site?", () => {
  const cases: Array<[string, Record<string, string>, boolean, string]> = [
    ["no headers at all (the Virtual Tour today)", {}, true, "none"],
    // Golden Verdict today: next.config.js sends X-Frame-Options: DENY, and its middleware CSP has no frame-ancestors
    [
      "Golden Verdict today",
      {
        "x-frame-options": "DENY",
        "content-security-policy": "default-src 'self'; script-src 'self' 'nonce-abc'; object-src 'none'",
      },
      false,
      "x-frame-options",
    ],
    ["X-Frame-Options: SAMEORIGIN", { "x-frame-options": "SAMEORIGIN" }, false, "x-frame-options"],
    [
      "obsolete ALLOW-FROM counts as a refusal",
      { "x-frame-options": `ALLOW-FROM ${ME}` },
      false,
      "x-frame-options",
    ],
    [
      "the documented fix: frame-ancestors names this site (and wins over a leftover XFO)",
      { "x-frame-options": "DENY", "content-security-policy": `frame-ancestors 'self' ${ME}` },
      true,
      "frame-ancestors",
    ],
    [
      "frame-ancestors 'none'",
      { "content-security-policy": "frame-ancestors 'none'" },
      false,
      "frame-ancestors",
    ],
    [
      "frame-ancestors 'self' only",
      { "content-security-policy": "frame-ancestors 'self'" },
      false,
      "frame-ancestors",
    ],
    ["frame-ancestors *", { "content-security-policy": "frame-ancestors *" }, true, "frame-ancestors"],
    ["a scheme source", { "content-security-policy": "frame-ancestors https:" }, true, "frame-ancestors"],
    [
      "a host wildcard",
      { "content-security-policy": "frame-ancestors https://*.vercel.app" },
      true,
      "frame-ancestors",
    ],
    [
      "a wildcard that does not cover us",
      { "content-security-policy": "frame-ancestors https://*.example.com" },
      false,
      "frame-ancestors",
    ],
    [
      "a bare host (https assumed)",
      { "content-security-policy": "frame-ancestors vishalbg.vercel.app" },
      true,
      "frame-ancestors",
    ],
    [
      "http:// is not https://",
      { "content-security-policy": "frame-ancestors http://vishalbg.vercel.app" },
      false,
      "frame-ancestors",
    ],
    [
      "two policies: both must allow (the second refuses)",
      { "content-security-policy": `frame-ancestors ${ME}, frame-ancestors 'none'` },
      false,
      "frame-ancestors",
    ],
    [
      "a CSP without frame-ancestors falls back to X-Frame-Options",
      { "content-security-policy": "default-src 'self'" },
      true,
      "none",
    ],
    [
      "an empty frame-ancestors allows nothing",
      { "content-security-policy": "frame-ancestors" },
      false,
      "frame-ancestors",
    ],
  ];

  it.each(cases)("%s", (_name, headers, embeddable, reason) => {
    expect(framing(h(headers), ME)).toEqual({ embeddable, reason });
  });

  it("refuses when the embedding origin itself is not a URL", () => {
    expect(framing(h({}), "nonsense").embeddable).toBe(false);
  });
});

describe("embeddableFrom: only a normal page answer says anything about framing", () => {
  const frame = { "x-frame-options": null, "content-security-policy": null };
  it("unknown when the probe failed, or when a bot wall or an error page answered", () => {
    expect(embeddableFrom({ ok: false, error: "timeout" }, ME)).toBeNull();
    expect(embeddableFrom({ ok: true, status: 403, latencyMs: 90, frame }, ME)).toBeNull();
    expect(embeddableFrom({ ok: true, status: 503, latencyMs: 90, frame }, ME)).toBeNull();
    expect(embeddableFrom({ ok: true, status: 200, latencyMs: 90 }, ME)).toBeNull();
  });
  it("reads the headers of a 200 or a redirect", () => {
    expect(embeddableFrom({ ok: true, status: 200, latencyMs: 90, frame }, ME)).toBe(true);
    expect(
      embeddableFrom(
        { ok: true, status: 200, latencyMs: 90, frame: { ...frame, "x-frame-options": "DENY" } },
        ME,
      ),
    ).toBe(false);
  });
});
