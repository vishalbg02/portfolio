import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { site } from "@/lib/site";

/**
 * A thread is opened with its id AND a signature of it. The id alone is not enough, so a leaked id (a log, a referrer)
 * gives nobody access; the browser keeps both, and the link in a reply email carries both.
 */
const secret = () => env.LIVE_CHAT_SIGNING_SECRET ?? "";

export function sign(id: string, key: string = secret()): string {
  return createHmac("sha256", key).update(`thread:${id}`).digest("base64url").slice(0, 24);
}

export function verify(id: string, sig: string, key: string = secret()): boolean {
  if (!key || !id || !sig) return false;
  const a = Buffer.from(sign(id, key));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The link in a reply email (and the one Vishal can open): the home page, which opens the thread. */
export const threadLink = (id: string, key: string = secret()) => `${site.url}/?chat=${id}.${sign(id, key)}`;

/** The one-click "stop emailing me" link. */
export const unsubscribeLink = (id: string, key: string = secret()) =>
  `${site.url}/api/live/unsubscribe?c=${id}&k=${sign(id, key)}`;
