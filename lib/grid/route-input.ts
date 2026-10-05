import type { PaletteGroup, PaletteItem } from "@/components/palette/commands";

/**
 * One input for commands and questions. What decides where Enter goes:
 *  - ">" in front: commands only ("> contact")
 *  - "?" in front: a question for GRID, no commands
 *  - otherwise a short input (≤ 3 words) that starts like a command's name ("work", "résumé", "contact") runs
 *    that command; anything else is a question for GRID. Matching commands stay listed below either way.
 */
export type Ranked = {
  /** The question GRID would get (null when only commands apply). */
  ask: string | null;
  /** Whether "Ask GRID" is the first (highlighted) row. */
  askFirst: boolean;
  /** Commands that match, grouped; the full list for an empty input. */
  groups: PaletteGroup[];
  /** The strongest command match, if any. */
  best: PaletteItem | null;
  commandsOnly: boolean;
};

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const words = (s: string) =>
  fold(s)
    .split(/[^a-z0-9+#.]+/)
    .filter(Boolean);

const haystack = (i: PaletteItem) => fold(`${i.label} ${(i.keywords ?? []).join(" ")} ${i.hint ?? ""}`);

export function filterGroups(groups: PaletteGroup[], query: string): PaletteGroup[] {
  const q = words(query);
  if (q.length === 0) return groups;
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => q.every((w) => haystack(i).includes(w))) }))
    .filter((g) => g.items.length > 0);
}

/**
 * Is the typed text (a few words) the NAME of this command? Every typed word has to begin a word of the command's
 * label ("copy email", "linkedin", "résumé"), or be one of its keywords exactly. A word that merely appears somewhere
 * inside ("in" inside "linkedin") does not count, so a question never gets hijacked by a command that happens to match.
 */
function strong(item: PaletteItem, q: string): boolean {
  const typed = words(q).filter((w) => w.length >= 2); // "match a job": the "a" is filler
  if (typed.length === 0) return false;
  const name = words(item.label);
  const keywords = (item.keywords ?? []).map(fold);
  // a prefix needs three letters ("con" → Contact); one or two must be a whole word ("in" is not "intro")
  return typed.every(
    (w) => name.some((n) => (w.length >= 3 ? n.startsWith(w) : n === w)) || keywords.includes(w),
  );
}

export function rankInput(raw: string, groups: PaletteGroup[]): Ranked {
  const trimmed = raw.trim();
  if (!trimmed) return { ask: null, askFirst: true, groups, best: null, commandsOnly: false };

  if (trimmed.startsWith(">")) {
    const q = trimmed.slice(1).trim();
    const filtered = filterGroups(groups, q);
    return {
      ask: null,
      askFirst: false,
      groups: filtered,
      best: filtered[0]?.items[0] ?? null,
      commandsOnly: true,
    };
  }
  if (trimmed.startsWith("?")) {
    const q = trimmed.slice(1).trim();
    return { ask: q || null, askFirst: true, groups: [], best: null, commandsOnly: false };
  }

  const filtered = filterGroups(groups, trimmed);
  const all = filtered.flatMap((g) => g.items);
  const best = all.find((i) => strong(i, trimmed)) ?? null;
  const commandFirst = best !== null && trimmed.split(/\s+/).length <= 3;
  return { ask: trimmed, askFirst: !commandFirst, groups: filtered, best, commandsOnly: false };
}
