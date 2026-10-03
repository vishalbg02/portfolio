import { describe, expect, it } from "vitest";
import { buildCsp } from "@/lib/security/csp";

describe("Content-Security-Policy", () => {
  const prod = buildCsp({ isDev: false, isPreview: false });
  const preview = buildCsp({ isDev: false, isPreview: true });

  it("production is strict: no vercel.live, no eval, no framing, upgrade-insecure-requests", () => {
    expect(prod).not.toContain("vercel.live");
    expect(prod).not.toContain("pusher");
    expect(prod).not.toContain("unsafe-eval");
    expect(prod).not.toContain("frame-src");
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("base-uri 'self'");
    expect(prod).toContain("form-action 'self'");
    expect(prod).toContain("upgrade-insecure-requests");
  });

  it("only allows the analytics origins the site actually uses", () => {
    expect(prod).toContain(
      "connect-src 'self' https://vitals.vercel-insights.com https://va.vercel-scripts.com",
    );
    expect(prod).not.toMatch(/https:\/\/\*(?!\.pusher)/); // no wildcard hosts
  });

  it("preview builds additionally allow Vercel's preview toolbar — and nothing else changes", () => {
    expect(preview).toContain(
      "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://vercel.live",
    );
    expect(preview).toContain("frame-src https://vercel.live");
    expect(preview).toContain("frame-ancestors 'none'");
    expect(preview).toContain("object-src 'none'");
    expect(preview).not.toContain("unsafe-eval");
  });

  it("dev adds unsafe-eval (React debugging) but not upgrade-insecure-requests", () => {
    const dev = buildCsp({ isDev: true, isPreview: false });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });
});
