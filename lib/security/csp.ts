/**
 * Content-Security-Policy builder (pure, so it can be unit-tested). Used by next.config.ts.
 *
 * Static policy, no nonce: every page stays statically generated. App Router emits inline
 * flight-data <script> tags, so script-src needs 'unsafe-inline' without per-request nonces.
 * Everything else is locked down. See README → "Security: CSP".
 */
import { EMBED_ORIGINS } from "./embeds";

export type CspEnv = {
  /** `next dev` needs 'unsafe-eval' for React's debugging. */
  isDev: boolean;
  /**
   * Vercel PREVIEW deployments inject a toolbar (comments/feedback) from vercel.live. It does not
   * exist in production, so only preview builds allow it — production keeps the strict policy.
   */
  isPreview: boolean;
};

export function buildCsp({ isDev, isPreview }: CspEnv): string {
  const live = isPreview ? " https://vercel.live" : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com${live}`,
    `style-src 'self' 'unsafe-inline'${live}`,
    `img-src 'self' data: blob:${isPreview ? " https://vercel.live https://vercel.com" : ""}`,
    `font-src 'self'${isPreview ? " https://vercel.live https://assets.vercel.com" : ""}`,
    `connect-src 'self' https://vitals.vercel-insights.com https://va.vercel-scripts.com${
      isPreview ? " https://vercel.live https://*.pusher.com wss://*.pusher.com" : ""
    }`,
    `frame-src ${[...EMBED_ORIGINS, ...(isPreview ? ["https://vercel.live"] : [])].join(" ")}`,
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
