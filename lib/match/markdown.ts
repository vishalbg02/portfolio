import type { MatchResult } from "./types";

const LABEL = { strong: "✅ Strong", partial: "🟡 Partial", gap: "⚪ Gap" } as const;

/** "Copy result as Markdown". Links are relative to the site origin. */
export function toMarkdown(
  result: MatchResult,
  origin: string,
  title = "Job description match — Vishal B G",
): string {
  const lines = [`# ${title}`, "", result.summary, ""];
  for (const r of result.results) {
    lines.push(`## ${r.requirement} — ${LABEL[r.match]} (${r.importance} priority)`);
    if (r.evidence.length === 0) lines.push("_No evidence on the portfolio._");
    for (const e of r.evidence) lines.push(`- ${e.text} — [${e.title}](${origin}${e.sourceUrl})`);
    lines.push("");
  }
  lines.push(
    `_Matched against ${origin} (${result.mode === "ai" ? "AI-assisted extraction" : "keyword extraction"}; grading is literal evidence only)._`,
  );
  return lines.join("\n").trim() + "\n";
}
