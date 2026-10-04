/**
 * The only origins the site may frame (CSP `frame-src`). Today that is the CHRIST Virtual Tour, whose
 * case study loads it in an iframe after a click. A unit test keeps this equal to the project's live URL
 * so the allow-list can't drift from what the page actually embeds.
 */
export const EMBED_ORIGINS = ["https://virtual-tour-opal.vercel.app"] as const;
