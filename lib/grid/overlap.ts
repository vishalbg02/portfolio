/**
 * Where the Omnibar may sit without covering anything you could click or type in. Pure geometry and one decision
 * function (unit-tested); Omnibar.tsx only feeds them what the page looks like.
 *
 * Desktop (≥ 768 px) shows one of three forms:
 *  - "pill": the full bar, bottom centre (at rest and while scrolling up);
 *  - "puck": a 48 px GRID face, bottom right (scrolling down, a field has focus, the footer is in view, Esc, or the
 *    pill would cover a control);
 *  - "tab": the puck tucked into the right edge, 12 px showing, when even the puck would cover a control.
 */
export type Rect = { left: number; top: number; right: number; bottom: number };
export type OmniMode = "pill" | "puck" | "tab";

export const OMNI = { gap: 20, pillH: 48, pillMaxW: 520, edge: 48, puck: 48, tab: 12 } as const;

/** The pill: min(520 px, 100vw − 48 px) wide, 48 px tall, centred, 20 px above the bottom (or the safe area). */
export function pillRect(vw: number, vh: number, safeBottom = 0): Rect {
  const w = Math.min(OMNI.pillMaxW, vw - OMNI.edge);
  const bottom = vh - Math.max(OMNI.gap, safeBottom);
  return { left: (vw - w) / 2, right: (vw + w) / 2, top: bottom - OMNI.pillH, bottom };
}

/** The puck: 48 × 48, 20 px from the right and the bottom. */
export function puckRect(vw: number, vh: number, safeBottom = 0): Rect {
  const bottom = vh - Math.max(OMNI.gap, safeBottom);
  const right = vw - OMNI.gap;
  return { left: right - OMNI.puck, right, top: bottom - OMNI.puck, bottom };
}

/** Points to hit-test inside a rect: `cols` across, on two rows, kept a few px inside its edges. */
export function samplePoints(r: Rect, cols = 5, inset = 6): Array<{ x: number; y: number }> {
  const w = r.right - r.left - inset * 2;
  const xs = Array.from(
    { length: cols },
    (_, i) => r.left + inset + (cols === 1 ? w / 2 : (w * i) / (cols - 1)),
  );
  const ys = [r.top + inset, r.bottom - inset];
  return ys.flatMap((y) => xs.map((x) => ({ x, y })));
}

export const intersects = (a: Rect, b: Rect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

export type OmniInput = {
  /** The last real scroll movement. */
  dir: "up" | "down" | "none";
  /** A text field, select or editable region (outside the Omnibar) has focus. */
  field: boolean;
  /** The footer is on screen. */
  footer: boolean;
  /** Esc was pressed; cleared by the next scroll up. */
  escaped: boolean;
  /** Something clickable sits under where the pill would be. */
  coversPill: boolean;
  /** Something clickable sits under where the puck would be. */
  coversPuck: boolean;
};

export function omniMode(s: OmniInput): OmniMode {
  const collapsed = s.field || s.footer || s.escaped || s.dir === "down" || s.coversPill;
  if (!collapsed) return "pill";
  return s.coversPuck ? "tab" : "puck";
}

/** Elements that count as "something you could click or type in". */
export const INTERACTIVE =
  'a[href], button, input, textarea, select, summary, label, [role="button"], [role="link"], [role="tab"], [role="switch"], [contenteditable="true"], [tabindex="0"]:not([role="group"]):not(section):not(main)';
