/**
 * The personal link's code, in the browser. It arrives as `?c=<id>.<signature>`, is kept for this tab (sessionStorage) so the
 * banner survives a reload and the pings can name the link, and is taken out of the address bar so it is not shared by
 * accident. The code carries no name: the company and role are looked up on the server by its signed id.
 */
export const LINK_KEY = "link:v1";
export const LINK_INFO_KEY = "link:info:v1";
export const SHAPE = /^[a-z0-9]{8}\.[A-Za-z0-9_-]{10,24}$/;

export const validToken = (v: unknown): v is string => typeof v === "string" && SHAPE.test(v);

const session = () => {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

export const readToken = (): string | null => {
  const t = session()?.getItem(LINK_KEY);
  return validToken(t) ? t : null;
};
export const saveToken = (t: string) => {
  try {
    session()?.setItem(LINK_KEY, t);
  } catch {
    /* blocked: it lasts for this page view */
  }
};
export const clearToken = () => {
  try {
    session()?.removeItem(LINK_KEY);
    session()?.removeItem(LINK_INFO_KEY);
  } catch {
    /* ignore */
  }
};

/** Takes `?c=` off the address (keeping everything else) and returns the code if it has the right shape. */
export function takeFromUrl(): string | null {
  const url = new URL(window.location.href);
  const c = url.searchParams.get("c");
  if (c === null) return null;
  url.searchParams.delete("c");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  return validToken(c) ? c : null;
}
