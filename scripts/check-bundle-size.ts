/**
 * Performance budget: the home route's initial JS (every <script src> in the prerendered
 * HTML, gzipped) must stay ≤ 170 KB. Run after `pnpm build` via `pnpm check:bundle`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_KB = Number(process.env.BUNDLE_BUDGET_KB ?? 170);
const ROUTES: Record<string, string> = { "/": ".next/server/app/index.html" };

export function scriptSources(html: string): string[] {
  const srcs = new Set<string>();
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)) {
    const tag = m[0];
    const src = m[1];
    if (/\bnoModule\b/i.test(tag)) continue; // legacy polyfills, not loaded by modern browsers
    if (src?.startsWith("/_next/")) srcs.add(src);
  }
  return [...srcs];
}

function main() {
  let failed = false;
  for (const [route, htmlPath] of Object.entries(ROUTES)) {
    if (!existsSync(htmlPath)) {
      console.error(`✕ ${htmlPath} not found — run \`pnpm build\` first.`);
      process.exit(1);
    }
    const html = readFileSync(htmlPath, "utf8");
    let total = 0;
    const rows: Array<[string, number]> = [];
    for (const src of scriptSources(html)) {
      const file = join(".next", src.replace(/^\/_next\//, "").split("?")[0]!);
      const size = gzipSync(readFileSync(file)).length;
      total += size;
      rows.push([src, size]);
    }
    const kb = total / 1024;
    rows.sort((a, b) => b[1] - a[1]);
    console.log(`Route ${route}: ${kb.toFixed(1)} KB gz initial JS (budget ${BUDGET_KB} KB)`);
    for (const [src, size] of rows.slice(0, 8))
      console.log(`  ${(size / 1024).toFixed(1).padStart(6)} KB  ${src}`);
    if (kb > BUDGET_KB) {
      console.error(`✕ ${route} exceeds the ${BUDGET_KB} KB budget.`);
      failed = true;
    }
  }
  process.exit(failed ? 1 : 0);
}

const isMain = process.argv[1] && /check-bundle-size\.ts$/.test(process.argv[1]);
if (isMain) main();
