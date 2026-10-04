/**
 * Keyboard navigation for the page: `j` and `k` move to the next and previous section, and `g` then a letter jumps to
 * one (`g w` Work, `g c` Contact …). Pure functions, so the chord timing and the section maths are unit-tested; the
 * listener lives in components/palette/ShortcutsHost.tsx.
 */
export const GOTO: Record<string, { id: string | null; label: string }> = {
  h: { id: null, label: "the top" },
  w: { id: "work", label: "Work" },
  e: { id: "experience", label: "Experience" },
  a: { id: "github", label: "Activity" },
  s: { id: "stack", label: "Stack" },
  g: { id: "ask", label: "GRID" },
  c: { id: "contact", label: "Contact" },
};

/** The `g` prefix is open for this long, in ms. */
export const CHORD_MS = 1200;

export type KeyAction =
  | { type: "next" }
  | { type: "prev" }
  | { type: "goto"; id: string | null; label: string }
  | { type: "tour" }
  | null;

/** A tiny state machine for `g` + letter. Feed it every plain keypress; it says what to do, if anything. */
export function createChord(ms = CHORD_MS) {
  let armedAt = -Infinity;
  return {
    feed(key: string, now: number): KeyAction {
      const k = key.length === 1 ? key.toLowerCase() : key;
      if (armedAt + ms >= now) {
        armedAt = -Infinity;
        const g = GOTO[k];
        if (g) return { type: "goto", id: g.id, label: g.label };
        // any other key cancels the chord and is handled as itself below
      }
      if (k === "g") {
        armedAt = now;
        return null;
      }
      if (k === "j") return { type: "next" };
      if (k === "k") return { type: "prev" };
      if (k === "t") return { type: "tour" };
      return null;
    },
    /** Whether `g` has just been pressed (the UI can show a hint). */
    armed: (now: number) => armedAt + ms >= now,
  };
}

/**
 * The section to move to. `tops` are the sections' distances from the top of the viewport (negative = already
 * scrolled past), in page order. A section within `slack` px of the top counts as the current one, so `j` from the
 * start of a section goes to the next, and `k` from the middle of one goes back to its own start first.
 */
export function stepSection(tops: number[], dir: 1 | -1, slack = 24): number | null {
  if (tops.length === 0) return null;
  if (dir === 1) {
    const i = tops.findIndex((t) => t > slack);
    return i === -1 ? null : i;
  }
  for (let i = tops.length - 1; i >= 0; i--) if (tops[i]! < -slack) return i;
  return null;
}
