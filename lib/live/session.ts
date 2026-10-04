/**
 * The visitor's way back into their thread: its id and signature, kept in this browser (localStorage, every access in
 * try/catch). The same pair is in the link of a reply email. Messages themselves are not kept here: they are fetched.
 */
export type LiveSession = { c: string; k: string; name: string };
const KEY = "live:v1";
const ID = /^[0-9a-f-]{36}$/;
const SIG = /^[A-Za-z0-9_-]{16,40}$/;

export function loadSession(): LiveSession | null {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Partial<LiveSession> | null;
    return v && typeof v.c === "string" && ID.test(v.c) && typeof v.k === "string" && SIG.test(v.k)
      ? { c: v.c, k: v.k, name: typeof v.name === "string" ? v.name.slice(0, 80) : "" }
      : null;
  } catch {
    return null;
  }
}
export function saveSession(s: LiveSession) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* blocked: the thread just isn't remembered on this browser */
  }
}
export function clearSession() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** "<id>.<signature>" from a reply email's link (?chat=…), or null. Nothing else in the URL is trusted. */
export function parseThreadParam(value: string | null): { c: string; k: string } | null {
  const m = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{16,40})$/.exec(value ?? "");
  return m ? { c: m[1]!, k: m[2]! } : null;
}
