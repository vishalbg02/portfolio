/**
 * The only sites this portfolio may show in an iframe (CSP `frame-src`), each with its own sandbox. Listing an origin
 * here only permits a frame; no frame is created unless `/api/status` reports that the site itself allows framing
 * (`embeddable`, read from its headers) and the visitor clicks "Launch live site".
 *
 * - CHRIST Virtual Tour: allows framing today. Pointer lock is for dragging the 360° view.
 * - Golden Verdict: sends `X-Frame-Options: DENY` today, so the page shows real captures and a link instead. Both its
 *   hosts are listed because the apex redirects to www (frame-src is checked on every redirect). See
 *   docs/EMBEDDING-GOLDEN-VERDICT.md for the one change on that site that would turn the live embed on.
 */
export type Embed = { origin: string; sandbox: string };

export const EMBEDS = [
  {
    origin: "https://virtual-tour-opal.vercel.app",
    sandbox: "allow-scripts allow-same-origin allow-pointer-lock",
  },
  {
    origin: "https://goldenverdict.com",
    sandbox: "allow-scripts allow-same-origin allow-forms allow-popups",
  },
  {
    origin: "https://www.goldenverdict.com",
    sandbox: "allow-scripts allow-same-origin allow-forms allow-popups",
  },
] as const satisfies readonly Embed[];

export const EMBED_ORIGINS: readonly string[] = EMBEDS.map((e) => e.origin);

/** The embed entry for a URL, or null when its origin may not be framed (or it is not a URL). */
export function embedFor(url: string | null | undefined): Embed | null {
  if (!url) return null;
  try {
    const origin = new URL(url).origin;
    return EMBEDS.find((e) => e.origin === origin) ?? null;
  } catch {
    return null;
  }
}
