/**
 * pnpm resume [--open]
 * Validates your résumé content, builds the PDF exactly as the website will serve it, checks it
 * still fits on one page and runs the résumé guard tests. Output: .resume/Vishal_BG_Resume.pdf
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { extractText, getDocumentProxy } from "unpdf";
import { ZodError } from "zod";

const OUT_DIR = ".resume";
const OUT = `${OUT_DIR}/Vishal_BG_Resume.pdf`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

async function main() {
  let model;
  try {
    const { buildResumeModel } = await import("@/lib/resume/model");
    model = buildResumeModel();
  } catch (err) {
    console.error(red("✕ Your résumé content is not valid:\n"));
    if (err instanceof ZodError) {
      for (const issue of err.issues)
        console.error(`  • ${issue.path.join(" › ") || "(root)"}: ${issue.message}`);
    } else {
      console.error(`  ${(err as Error).message}`);
    }
    console.error(dim("\n  Fix content/resume.ts or content/profile.ts and run `pnpm resume` again."));
    process.exit(1);
  }

  const { ResumeDocument } = await import("@/lib/resume/ResumeDocument");
  const pdf = new Uint8Array(await renderToBuffer(ResumeDocument({ model })));
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT, pdf);

  const { totalPages } = await extractText(await getDocumentProxy(pdf.slice()), { mergePages: true });
  const kb = (pdf.length / 1024).toFixed(1);
  console.log(
    `\n${green("✓")} Built ${OUT}  ${dim(`(${kb} KB, ${totalPages} page${totalPages === 1 ? "" : "s"}, last updated ${model.updatedAt})`)}`,
  );
  if (totalPages > 1) {
    console.log(
      red("✕ It spills onto a second page. Shorten a bullet in content/resume.ts (or drop one) and re-run."),
    );
  }

  console.log(dim("\nRunning résumé checks…"));
  const tests = spawnSync("pnpm", ["exec", "vitest", "run", "tests/unit/resume.test.ts", "--reporter=dot"], {
    stdio: "inherit",
  });
  if (tests.status !== 0 || totalPages > 1) {
    console.log(red("\n✕ Checks failed — read the messages above (they say exactly what to add or trim)."));
    process.exit(1);
  }

  console.log(`\n${green("✓ All checks passed.")}`);
  console.log(`  Preview:  open ${OUT}`);
  console.log(
    '  Publish:  git add -A && git commit -m "docs(resume): update" && git push   (Vercel redeploys; /resume and /resume.pdf update)\n',
  );

  if (process.argv.includes("--open") && process.platform === "darwin") spawnSync("open", [OUT]);
}

void main();
