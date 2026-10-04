/**
 * Two letters for a company, drawn by code in a flat square (no logos, no external images): the first letters of the
 * first two words, ignoring anything in brackets and a trailing legal suffix. "Social Agent (Bricstal Pvt. Ltd.)" is
 * "SA"; "Golden Verdict, Bengaluru" is "GV"; a one-word name gives its first two letters.
 */
export function monogram(company: string): string {
  const words = company
    .replace(/\([^)]*\)/g, " ")
    .split(",")[0]!
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w && !/^(pvt|ltd|inc|llc|llp|co)$/i.test(w));
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}
