/**
 * "Jump to proof": a cited source in GRID takes you to the thing it cites and flashes it.
 * Same page → smooth-scroll + a 2 px green outline for 1.5 s. Another page → navigate with
 * `#proof=<id>`, which the ProofHost on arrival turns into the same scroll + flash.
 */
export const PROOF_PARAM = "proof=";
export const FLASH_MS = 1500;
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export type JumpTarget = { type: "scroll"; id: string } | { type: "navigate"; href: string }; // href may carry #proof=<id>

/** Where a source URL ("/work/talnio#architecture", "/#github", "/resume") points. */
export function splitUrl(url: string): { path: string; id: string | null } {
  const [path = "/", hash = ""] = url.split("#");
  return { path: path || "/", id: ID.test(hash) ? hash : null };
}

export function jumpTarget(url: string, currentPath: string): JumpTarget {
  const { path, id } = splitUrl(url);
  if (!id) return { type: "navigate", href: path };
  if (path === currentPath) return { type: "scroll", id };
  return { type: "navigate", href: `${path}#${PROOF_PARAM}${id}` };
}

/** "#proof=architecture" → "architecture"; anything that isn't a plain id → null (it is user-controlled). */
export function parseProofHash(hash: string): string | null {
  const raw = hash.replace(/^#/, "");
  if (!raw.startsWith(PROOF_PARAM)) return null;
  const id = raw.slice(PROOF_PARAM.length);
  return ID.test(id) ? id : null;
}

/** Scrolls an element into view and outlines it briefly. Returns false if there is no such element. */
export function flashProof(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  el.setAttribute("data-proof-flash", "true");
  window.setTimeout(() => el.removeAttribute("data-proof-flash"), FLASH_MS);
  return true;
}
