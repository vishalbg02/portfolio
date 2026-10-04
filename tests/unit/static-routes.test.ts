import { describe, expect, it } from "vitest";
import { dynamicPages } from "@/lib/check/static-routes";

describe("static-routes guard", () => {
  const prerendered = ["/", "/work", "/work/talnio", "/resume.pdf", "/vishal-b-g.vcf", "/_not-found"];
  const dynamic = ["/work/[slug]"];

  it("accepts pages and generated files that are prerendered, [param] routes whose params are generated, and /api/*", () => {
    const paths = [
      "/page",
      "/work/page",
      "/work/[slug]/page",
      "/resume.pdf/route",
      "/vishal-b-g.vcf/route",
      "/_not-found/page",
      "/api/chat/route",
      "/api/telegram/webhook/route",
    ];
    expect(dynamicPages(paths, prerendered, dynamic)).toEqual([]);
  });

  it("names every page that would be rendered on each request (a page that reads cookies, headers or search params at render time)", () => {
    const bad = dynamicPages(
      ["/page", "/privacy/page", "/work/[slug]/page", "/log/[slug]/page", "/me/route"],
      ["/"],
      ["/work/[slug]"],
    );
    expect(bad.map((b) => b.route)).toEqual(["/privacy", "/log/[slug]", "/me"]);
    expect(bad[0]!.reason).toContain("every request");
  });

  it("does not let a route named like an API through unless it really is under /api", () => {
    expect(dynamicPages(["/apiary/page", "/api/x/route"], [], []).map((b) => b.route)).toEqual(["/apiary"]);
  });
});
