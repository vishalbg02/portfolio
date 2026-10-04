/**
 * Every page is static: only /api/* (and the files that are generated at build time) may be dynamic. This works out, from the
 * build's manifests, which routes would be rendered on demand. Pure, so it is unit-tested; scripts/check-static-routes.ts reads
 * the manifests after `pnpm build`.
 */
export type Violation = { route: string; reason: string };

const routeOf = (appPath: string) => {
  const r = appPath.replace(/\/(page|route)$/, "");
  return r === "" ? "/" : r;
};

/**
 * @param appPaths keys of .next/server/app-paths-manifest.json ("/work/[slug]/page", "/api/chat/route")
 * @param prerendered keys of prerender-manifest `routes`
 * @param dynamicPrerendered keys of prerender-manifest `dynamicRoutes` (a [param] route whose params are generated at build time)
 * @param allowedDynamic routes that are allowed to render on demand
 */
export function dynamicPages(
  appPaths: string[],
  prerendered: string[],
  dynamicPrerendered: string[],
  allowedDynamic: RegExp[] = [/^\/api\//],
): Violation[] {
  const pre = new Set(prerendered);
  const dyn = new Set(dynamicPrerendered);
  const out: Violation[] = [];
  for (const p of appPaths) {
    const route = routeOf(p);
    if (allowedDynamic.some((re) => re.test(route))) continue;
    if (pre.has(route) || dyn.has(route)) continue;
    out.push({ route, reason: "not in the prerender manifest: it would be rendered on every request" });
  }
  return out;
}
