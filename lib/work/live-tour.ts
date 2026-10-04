import { EMBED_ORIGINS } from "@/lib/security/embeds";

/**
 * Loads the CHRIST Virtual Tour into a frame, in place. Nothing is requested from the tour's origin until
 * this runs (the visitor clicked "Launch live demo"). The iframe is sandboxed (scripts, same-origin and
 * pointer lock only), sends no referrer, and its origin is the only entry in the CSP's frame-src; anything
 * else is refused here as well.
 */
export function launchLiveTour(slot: HTMLElement, src: string): boolean {
  let origin: string;
  try {
    origin = new URL(src).origin;
  } catch {
    return false;
  }
  if (!(EMBED_ORIGINS as readonly string[]).includes(origin)) return false;
  if (slot.querySelector("iframe")) {
    slot.hidden = false;
    return true;
  }
  const frame = document.createElement("iframe");
  frame.src = src;
  frame.title = "CHRIST University Virtual Tour, live demo";
  frame.loading = "lazy";
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-pointer-lock");
  frame.setAttribute("allow", "fullscreen");
  frame.referrerPolicy = "no-referrer";
  frame.className = "absolute inset-0 size-full border-0";
  slot.appendChild(frame);
  slot.hidden = false;
  return true;
}
