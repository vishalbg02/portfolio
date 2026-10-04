import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { site } from "@/lib/site";

/**
 * A personal link is `?c=<id>.<signature>`. The id is random; the signature is an HMAC of it, so a made-up or altered
 * code is refused before anything is looked up, and the page can only ever show a label Vishal created.
 */
const secret = () => env.LIVE_CHAT_SIGNING_SECRET ?? "";

export const ID_RE = /^[a-z0-9]{8}$/;

export const newLinkId = (): string => Array.from(randomBytes(8), (b) => (b % 36).toString(36)).join("");

export const signLink = (id: string, key: string = secret()): string =>
  createHmac("sha256", key).update(`link:${id}`).digest("base64url").slice(0, 16);

export const linkToken = (id: string, key: string = secret()) => `${id}.${signLink(id, key)}`;

/** The id inside a token, if (and only if) the signature is right. */
export function parseLinkToken(token: unknown, key: string = secret()): string | null {
  if (typeof token !== "string" || !key) return null;
  const [id, sig, ...extra] = token.split(".");
  if (extra.length || !id || !sig || !ID_RE.test(id)) return null;
  const a = Buffer.from(signLink(id, key));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

export const linkUrl = (id: string, key: string = secret()) => `${site.url}/?c=${linkToken(id, key)}`;
