import { describe, expect, it } from "vitest";
import { scriptSources } from "@/scripts/check-bundle-size";

describe("bundle size check", () => {
  it("collects /_next script sources and skips noModule polyfills and duplicates", () => {
    const html = `
      <script src="/_next/static/chunks/a.js" async=""></script>
      <script src="/_next/static/chunks/a.js" async=""></script>
      <script src="/_next/static/chunks/polyfills.js" noModule=""></script>
      <script src="https://example.com/x.js"></script>
      <script>self.__next_f.push([1,""])</script>
      <script src="/_next/static/chunks/b.js" integrity="sha256-x" id="_R_" async=""></script>`;
    expect(scriptSources(html)).toEqual(["/_next/static/chunks/a.js", "/_next/static/chunks/b.js"]);
  });
});
