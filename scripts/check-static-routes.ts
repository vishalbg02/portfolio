/**
 * Static-rendering guard: every route except /api/* must be prerendered at build time (the pages are static and CDN-cached
 * by design; see README, "Engineering decisions"). Run after `pnpm build` via `pnpm check:static`.
 */
import { existsSync, readFileSync } from "node:fs";
import { dynamicPages } from "../lib/check/static-routes";

const read = (p: string) => {
  if (!existsSync(p)) {
    console.error(`✕ ${p} not found: run \`pnpm build\` first.`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
};

const appPaths = Object.keys(read(".next/server/app-paths-manifest.json"));
const manifest = read(".next/prerender-manifest.json") as {
  routes: Record<string, unknown>;
  dynamicRoutes?: Record<string, unknown>;
};
const bad = dynamicPages(appPaths, Object.keys(manifest.routes), Object.keys(manifest.dynamicRoutes ?? {}));
const apis = appPaths.filter((p) => p.startsWith("/api/")).length;

if (bad.length > 0) {
  console.error("✕ These routes are not static:");
  for (const b of bad) console.error(`  ${b.route}: ${b.reason}`);
  process.exit(1);
}
console.log(
  `✓ Every page is static (${appPaths.length - apis} prerendered routes; ${apis} API routes are dynamic by design).`,
);
