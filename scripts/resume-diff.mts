/**
 * pnpm resume:diff path/to/your-edited-resume.pdf
 * You edited a PDF somewhere else (Canva, Word, LaTeX…)? This shows which lines are in YOUR file but
 * not in the résumé the website generates — i.e. what to copy into content/resume.ts / profile.ts —
 * and which generated lines your file does not have. Informational only.
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { readFileSync } from "node:fs";
import { extractText, getDocumentProxy } from "unpdf";

const squash = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/[^a-z0-9]+/g, "");

async function linesOf(pdf: Uint8Array): Promise<string[]> {
  const out = await extractText(await getDocumentProxy(pdf), { mergePages: true });
  return out.text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => squash(l).length >= 6);
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: pnpm resume:diff <path-to-your-pdf>");
    process.exit(1);
  }
  const theirs = await linesOf(new Uint8Array(readFileSync(path)));
  const { buildResumeModel } = await import("@/lib/resume/model");
  const { ResumeDocument } = await import("@/lib/resume/ResumeDocument");
  const ours = await linesOf(
    new Uint8Array(await renderToBuffer(ResumeDocument({ model: buildResumeModel() }))),
  );

  const oursBlob = squash(ours.join(" "));
  const theirsBlob = squash(theirs.join(" "));
  const onlyTheirs = theirs.filter((l) => !oursBlob.includes(squash(l)));
  const onlyOurs = ours.filter((l) => !theirsBlob.includes(squash(l)));

  const show = (title: string, lines: string[]) => {
    console.log(`\n${title} (${lines.length})`);
    for (const l of lines) console.log(`  • ${l}`);
    if (lines.length === 0) console.log("  — none —");
  };
  show(
    "In YOUR PDF but not in the generated résumé  → copy these into content/resume.ts or profile.ts",
    onlyTheirs,
  );
  show("In the generated résumé but not in YOUR PDF → intentional, or outdated on your side", onlyOurs);
  console.log(
    "\nTip: lines that only differ by where they wrap are ignored; wording differences are reported.\n",
  );
}

void main();
