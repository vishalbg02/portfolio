const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word (or whole-phrase) match, case-insensitive: "java" does NOT match "javascript". */
export function containsTerm(text: string, term: string): boolean {
  return new RegExp(`(?<![a-z0-9])${escape(term.toLowerCase())}(?![a-z0-9])`).test(text.toLowerCase());
}

/** The sentence of `text` that contains `term` (≤ max chars), for showing as evidence. */
export function snippetFor(text: string, term: string, max = 230): string {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const hit = sentences.find((x) => containsTerm(x, term)) ?? sentences[0] ?? text;
  const clean = hit.replace(/^•\s*/, "").replace(/\*\*/g, "");
  return clean.length <= max ? clean : clean.slice(0, clean.lastIndexOf(" ", max)).trimEnd() + "…";
}
