import { embedFor } from "@/lib/security/embeds";

/**
 * Loads a project's live site into a frame, in place. Nothing is requested from that site until this runs (the visitor
 * clicked "Launch live site"). Only origins listed in lib/security/embeds.ts (the CSP's frame-src) are accepted, each
 * with its own sandbox; the frame sends no referrer. Anything else is refused here as well.
 */
export function launchLiveEmbed(slot: HTMLElement, src: string, title: string): boolean {
  const embed = embedFor(src);
  if (!embed) return false;
  if (slot.querySelector("iframe")) {
    slot.hidden = false;
    return true;
  }
  const frame = document.createElement("iframe");
  frame.src = src;
  frame.title = title;
  frame.loading = "lazy";
  frame.setAttribute("sandbox", embed.sandbox);
  frame.setAttribute("allow", "fullscreen");
  frame.referrerPolicy = "no-referrer";
  frame.className = "absolute inset-0 size-full border-0";
  slot.appendChild(frame);
  slot.hidden = false;
  return true;
}
