/** Pure helpers for terminal input (history navigation and Tab completion), shared by both terminals. */

export type HistoryStep = { cursor: number | null; value: string };

/**
 * ↑/↓ through history. `cursor` is the index being shown, or null when editing a fresh line.
 * Going down past the newest entry returns to an empty fresh line.
 */
export function historyStep(history: string[], cursor: number | null, dir: "up" | "down"): HistoryStep {
  if (history.length === 0) return { cursor: null, value: "" };
  const cur = cursor ?? history.length;
  const next = Math.min(history.length, Math.max(0, cur + (dir === "up" ? -1 : 1)));
  return next === history.length ? { cursor: null, value: "" } : { cursor: next, value: history[next]! };
}

export function commonPrefix(items: string[]): string {
  if (items.length === 0) return "";
  return items.reduce((p, s) => {
    let i = 0;
    while (i < p.length && i < s.length && p[i] === s[i]) i++;
    return p.slice(0, i);
  });
}

/**
 * Tab completion of the last word. One candidate → complete it (plus a space); several → complete the
 * common prefix and report the candidates so the UI can list them.
 */
export function applyTab(value: string, options: string[]): { value: string; listed: string[] } {
  if (options.length === 0) return { value, listed: [] };
  const words = value.split(/\s+/);
  words[words.length - 1] = commonPrefix(options);
  return {
    value: words.join(" ") + (options.length === 1 ? " " : ""),
    listed: options.length > 1 ? options : [],
  };
}
