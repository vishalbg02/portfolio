/**
 * Design rule guard: NO GRADIENTS anywhere (CSS, Tailwind classes, SVG, canvas).
 * Run via `pnpm check:gradients` (part of `pnpm lint`). Exits 1 on any match.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

export type GradientMatch = { file: string; line: number; text: string; rule: string };

const RULES: Array<{ name: string; re: RegExp }> = [
  { name: "css-gradient", re: /\b(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/i },
  { name: "tailwind-gradient", re: /(?<![\w-])bg-(?:linear|radial|conic|gradient)-/ },
  { name: "tailwind-mask-gradient", re: /(?<![\w-])mask-(?:linear|radial|conic)-/ },
  { name: "svg-gradient", re: /<\s*(?:linearGradient|radialGradient)\b/ },
  { name: "canvas-gradient", re: /\bcreate(?:Linear|Radial|Conic)Gradient\s*\(/ },
];

const SCAN_DIRS = ["app", "components", "content", "lib", "styles", "public", "hooks"];
const EXTENSIONS = new Set([".css", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".mdx", ".svg", ".html"]);
const IGNORE = new Set(["node_modules", ".next", ".git", "generated"]);

export function findGradients(content: string, file = "<input>"): GradientMatch[] {
  const matches: GradientMatch[] = [];
  content.split(/\r?\n/).forEach((text, i) => {
    for (const rule of RULES) {
      if (rule.re.test(text)) {
        matches.push({ file, line: i + 1, text: text.trim().slice(0, 160), rule: rule.name });
      }
    }
  });
  return matches;
}

function* walk(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (IGNORE.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walk(full);
    else if (EXTENSIONS.has(extname(entry))) yield full;
  }
}

export function scan(root: string): GradientMatch[] {
  const results: GradientMatch[] = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(root, dir))) {
      const rel = relative(root, file).split(sep).join("/");
      results.push(...findGradients(readFileSync(file, "utf8"), rel));
    }
  }
  return results;
}

const isMain = process.argv[1] && /check-no-gradients\.ts$/.test(process.argv[1]);
if (isMain) {
  const matches = scan(process.cwd());
  if (matches.length > 0) {
    console.error(`✕ Gradients are not allowed (design rule §2). Found ${matches.length}:`);
    for (const m of matches) console.error(`  ${m.file}:${m.line}  [${m.rule}]  ${m.text}`);
    process.exit(1);
  }
  console.log("✓ No gradients found.");
}
