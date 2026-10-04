import { LIMITS } from "../limits";

/** Lower-case, accents folded, punctuation (except . + # ') dropped, spaces collapsed. */
export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const JD_MARKERS = [
  /responsibilit/,
  /requirement/,
  /qualification/,
  /\bwe(?:'| a)?re (?:looking|hiring|seeking)/,
  /\bjob (?:description|title|summary)\b/,
  /\bmust have\b|\bnice to have\b|\bpreferred\b/,
  /\b\d+\+? years?\b/,
  /\babout the (?:role|job|position|team)\b/,
  /\bwhat you(?:'| wi)ll (?:do|bring)\b/,
];
export const looksLikeJobDescription = (raw: string) =>
  raw.length >= 280 && JD_MARKERS.filter((re) => re.test(norm(raw))).length >= 2;

/**
 * How long a visitor's message may be. A pasted job posting gets the job-description limit: the router answers it
 * with the deterministic matcher and the model never sees it, so the larger allowance costs nothing. Everything
 * else keeps the small chat limit. Used by the browser (to say "too long") and the server (to refuse), so they agree.
 */
export const inputLimit = (text: string) =>
  looksLikeJobDescription(text) ? LIMITS.jdInputChars : LIMITS.chatInputChars;
