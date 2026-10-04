/**
 * pnpm tsx scripts/write-lighthouse.mts --commit <sha> [--run-url <url>] [--dir .lighthouseci]
 * Turns a Lighthouse CI run (its manifest.json) into generated/lighthouse.json, which the footer
 * "This site" strip reads. Run by .github/workflows/lighthouse-prod.yml; nothing here is hand-edited.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fromManifest, type ManifestEntry } from "@/lib/lighthouse";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const dir = arg("dir") ?? ".lighthouseci";
const commit = arg("commit");
if (!commit) {
  console.error("Pass --commit <sha>");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8")) as ManifestEntry[];
const data = fromManifest(manifest, {
  generatedAt: new Date().toISOString(),
  commit: commit.slice(0, 7),
  runUrl: arg("run-url") ?? null,
});
writeFileSync("generated/lighthouse.json", JSON.stringify(data, null, 2) + "\n");
const s = data.scores;
console.log(
  `✓ generated/lighthouse.json — performance ${s.performance}, accessibility ${s.accessibility}, best practices ${s.bestPractices}, SEO ${s.seo} (${data.runs} runs)`,
);
