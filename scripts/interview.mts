/**
 * pnpm interview [--list]
 *
 * Write your own answers to the 12 interview questions GRID's Interview mode uses (content/interview.ts). It shows each
 * question and what is there now; you type your answer in your own words. GRID shows these verbatim, as a quote, and
 * never writes or rewords them. Interview mode appears on the site once at least 3 are answered.
 *
 *   Enter on an empty line  keep what is there and go to the next question
 *   type, then "." alone    save that answer (it can be several lines)
 *   "-" alone               remove the answer (back to "not written yet")
 *   "q" alone               save what you have done so far and stop
 *
 * Afterwards it formats the file and re-builds the AI's index (`pnpm embeddings`, which needs GEMINI_API_KEY in
 * .env.local; without it the answers are still searchable by keyword). Review with `git diff`, then commit.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { INTERVIEW_MIN_ANSWERS, InterviewEntrySchema, interviewBank } from "../content/interview";
import { setAnswer } from "../lib/content/interview-edit";

const FILE = "content/interview.ts";
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

/** Loads GEMINI_API_KEY (and friends) from .env.local for `pnpm embeddings`. Values are never printed. */
function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(?:"(.*)"|(.*))$/.exec(line.trim());
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2] ?? m[3] ?? "";
  }
}

const answers = new Map(interviewBank.map((e) => [e.id, e.answer]));
const count = () => [...answers.values()].filter((a) => a !== null).length;

function list() {
  for (const [i, e] of interviewBank.entries()) {
    const a = answers.get(e.id);
    console.log(`${a ? green("✓") : dim("·")} ${String(i + 1).padStart(2)}. ${e.question}`);
  }
  const n = count();
  console.log(
    `\n${n} of ${interviewBank.length} answered. ` +
      (n >= INTERVIEW_MIN_ANSWERS
        ? green("Interview mode is on.")
        : yellow(`Interview mode turns on at ${INTERVIEW_MIN_ANSWERS}.`)),
  );
}

async function main() {
  if (process.argv.includes("--list")) return list();
  const rl = createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });
  // read lines through the iterator: it queues them, so pasted (or piped) text is never dropped
  const input = rl[Symbol.asyncIterator]();
  const ask = async (prompt: string) => {
    stdout.write(prompt);
    const r = await input.next();
    return r.done ? null : r.value;
  };
  let source = readFileSync(FILE, "utf8");
  let changed = 0;
  console.log(
    bold("Interview notes, in your own words.") +
      dim(" Enter = keep · type then '.' = save · '-' = remove · 'q' = stop\n"),
  );

  outer: for (const [i, e] of interviewBank.entries()) {
    const now = answers.get(e.id) ?? null;
    console.log(bold(`${i + 1}/${interviewBank.length}  ${e.question}`));
    console.log(now ? dim(`  now: ${now}`) : dim("  now: not written yet"));
    for (;;) {
      const lines: string[] = [];
      for (;;) {
        const line = await ask(lines.length ? "  … " : "  > ");
        if (line === null) break outer; // end of input: save what is done
        if (lines.length === 0 && line.trim() === "") break; // keep
        if (lines.length === 0 && line.trim() === "q") break outer;
        if (lines.length === 0 && line.trim() === "-") {
          lines.push("-");
          break;
        }
        if (line.trim() === ".") break;
        lines.push(line);
      }
      if (lines.length === 0) break; // kept
      const next = lines[0] === "-" ? null : lines.join("\n").trim();
      const checked = InterviewEntrySchema.safeParse({ ...e, answer: next });
      if (!checked.success) {
        console.log(
          red(`  ${checked.error.issues[0]?.message ?? "not valid"} (an answer is 20 to 900 characters)`),
        );
        continue; // ask again
      }
      source = setAnswer(source, e.id, next);
      answers.set(e.id, next);
      changed++;
      console.log(green(next === null ? "  removed" : "  saved"));
      break;
    }
    console.log("");
  }
  rl.close();

  if (changed === 0) {
    console.log(dim("Nothing changed."));
    return list();
  }
  writeFileSync(FILE, source);
  execFileSync("pnpm", ["exec", "prettier", "--write", FILE], { stdio: "ignore" });
  console.log(green(`✓ ${changed} change(s) written to ${FILE}`));
  loadEnvLocal();
  console.log(dim("Re-building the AI's index (pnpm embeddings)…"));
  try {
    execFileSync("pnpm", ["-s", "embeddings"], { stdio: "inherit", env: process.env });
  } catch {
    console.log(
      yellow("  The index was not re-built; run `pnpm embeddings` later. The answers still work by keyword."),
    );
  }
  list();
  console.log(dim("\nReview with `git diff content/interview.ts`, then commit and push."));
}

void main();
