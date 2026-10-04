import { describe, expect, it } from "vitest";
import { profile } from "@/content/profile";
import { buildCsp } from "@/lib/security/csp";
import { EMBED_ORIGINS } from "@/lib/security/embeds";

describe("Content-Security-Policy", () => {
  const prod = buildCsp({ isDev: false, isPreview: false });
  const preview = buildCsp({ isDev: false, isPreview: true });

  it("frame-src allows exactly one origin, the Virtual Tour the case study embeds, and nothing else", () => {
    const tour = new URL(profile.projects.find((p) => p.slug === "virtual-tour")!.live!).origin;
    expect([...EMBED_ORIGINS]).toEqual([tour]);
    const directive = prod.split("; ").find((d) => d.startsWith("frame-src"))!;
    expect(directive).toBe(`frame-src ${tour}`);
    expect(prod).not.toMatch(/frame-src[^;]*\*/);
    expect(prod).not.toContain("child-src");
  });

  it("production is strict: no vercel.live, no eval, upgrade-insecure-requests, and nobody may frame us", () => {
    expect(prod).not.toContain("vercel.live");
    expect(prod).not.toContain("pusher");
    expect(prod).not.toContain("unsafe-eval");
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

  it("allows Cloudflare Turnstile only when its site key is set, and only its challenge origin, for scripts, frames and its own call", () => {
    const cf = "https://challenges.cloudflare.com";
    const withKey = buildCsp({ isDev: false, isPreview: false, turnstile: true });
    const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(name))!;
    expect(prod).not.toContain("cloudflare");
    for (const d of ["script-src", "connect-src", "frame-src"])
      expect(directive(withKey, d), d).toContain(cf);
    for (const d of ["default-src", "style-src", "img-src", "font-src", "media-src", "form-action"])
      expect(directive(withKey, d), d).not.toContain(cf);
    expect(withKey).not.toMatch(/\*\.cloudflare/);
    // everything else is exactly as strict as before
    expect(withKey.replaceAll(` ${cf}`, "")).toBe(prod);
  });

  it("preview builds additionally allow Vercel's preview toolbar — and nothing else changes", () => {
    expect(preview).toContain(
      "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://vercel.live",
    );
    expect(preview).toContain(`frame-src ${EMBED_ORIGINS[0]} https://vercel.live`);
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
