/**
 * Model output is untrusted. It is only ever rendered as React text (never as HTML), and on top of
 * that this strips anything that could mislead: links, HTML, code fences and raw URLs.
 * Allowed: paragraphs, "- " bullets, **bold**, and [n] citation markers.
 */
export function sanitizeAnswer(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, "") // code fences
    .replace(/<[^>]*>/g, "") // HTML tags
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]+)\]\((?:https?:|mailto:|tel:|javascript:|data:)[^)]*\)/gi, "$1") // [text](url) → text
    .replace(/\b(?:https?:\/\/|www\.)[^\s)]+/gi, "") // raw URLs
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type Inline =
  { kind: "text"; text: string } | { kind: "bold"; text: string } | { kind: "cite"; n: number };
export type Block = { kind: "p"; inline: Inline[] } | { kind: "ul"; items: Inline[][] };

/** Parses `**bold**` and `[n]` markers; citations beyond `maxCite` are dropped (the model may only cite what exists). */
export function parseInline(text: string, maxCite: number): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*([^*]+)\*\*|\[(\d{1,2})\]/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: "bold", text: m[1] });
    else {
      const n = Number(m[2]);
      if (n >= 1 && n <= maxCite) out.push({ kind: "cite", n });
    }
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out.map((i) => (i.kind === "text" ? { ...i, text: i.text.replace(/\*\*/g, "") } : i));
}

export function parseBlocks(text: string, maxCite: number): Block[] {
  const blocks: Block[] = [];
  for (const para of sanitizeAnswer(text).split(/\n{2,}/)) {
    const lines = para.split("\n").filter((l) => l.trim());
    if (lines.length === 0) continue;
    const bullets = lines.filter((l) => /^\s*(?:[-*•]|\d+\.)\s+/.test(l));
    if (bullets.length === lines.length) {
      blocks.push({
        kind: "ul",
        items: lines.map((l) => parseInline(l.replace(/^\s*(?:[-*•]|\d+\.)\s+/, ""), maxCite)),
      });
    } else {
      blocks.push({ kind: "p", inline: parseInline(lines.join(" "), maxCite) });
    }
  }
  return blocks;
}

/** Numbers of the sources the answer actually cites. */
export function citedNumbers(text: string, maxCite: number): number[] {
  const set = new Set<number>();
  for (const m of text.matchAll(/\[(\d{1,2})\]/g)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= maxCite) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}
