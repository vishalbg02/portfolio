"use client";

import { useEffect, useRef } from "react";

/** What an element can announce with data-cursor="…". */
export const CURSOR_LABELS = ["open", "play", "drag", "copy", "ask"] as const;
export type CursorLabel = (typeof CURSOR_LABELS)[number];

const isLabel = (v: string | undefined): v is CursorLabel => CURSOR_LABELS.includes(v as CursorLabel);
const TEXT_TARGET = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

/** Snaps a coordinate to the 4 px grid the site is drawn on. */
export const snap = (n: number) => Math.round(n / 4) * 4;

/**
 * The context cursor (desktop with a fine pointer, motion allowed): a small flat square that follows the pointer,
 * snapped to the grid, and over anything marked data-cursor="open | play | drag | copy | ask" grows into a mono label
 * in the accent colour (the native cursor is hidden only over those). Over text fields it steps aside so the I-beam
 * stays. It is an extra marker, never a replacement: with it off, nothing is missing. All updates are transforms.
 */
export default function ContextCursor() {
  const box = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = box.current;
    const label = text.current;
    if (!el || !label) return;
    const root = document.documentElement;
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    let shown = false;
    let current: CursorLabel | null = null;

    const frame = () => {
      raf = 0;
      x += (tx - x) * 0.4;
      y += (ty - y) * 0.4;
      if (Math.abs(tx - x) < 0.5 && Math.abs(ty - y) < 0.5) {
        x = tx;
        y = ty;
      } else raf = requestAnimationFrame(frame);
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const setLabel = (next: CursorLabel | null) => {
      if (next === current) return;
      current = next;
      label.textContent = next ?? "";
      el.dataset.label = next ?? "";
      if (next) root.dataset.cursorActive = "";
      else delete root.dataset.cursorActive;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      const target = e.target as Element | null;
      const onText = Boolean(target?.closest?.(TEXT_TARGET));
      const tagged = target?.closest?.<HTMLElement>("[data-cursor]");
      const wanted = !onText && tagged && isLabel(tagged.dataset.cursor) ? tagged.dataset.cursor : null;
      setLabel(wanted);
      // the label sits to the lower right of the pointer, the plain square on it
      tx = snap(e.clientX) + (wanted ? 12 : -4);
      ty = snap(e.clientY) + (wanted ? 12 : -4);
      if (!shown) {
        shown = true;
        x = tx;
        y = ty;
        el.style.opacity = "1";
      }
      el.dataset.hidden = onText ? "true" : "false";
      kick();
    };
    const hide = () => {
      shown = false;
      el.style.opacity = "0";
      setLabel(null);
    };
    const onLeave = (e: MouseEvent) => {
      if (!e.relatedTarget) hide();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("mouseout", onLeave);
    window.addEventListener("blur", hide);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseout", onLeave);
      window.removeEventListener("blur", hide);
      cancelAnimationFrame(raf);
      delete root.dataset.cursorActive;
    };
  }, []);

  return (
    <div
      ref={box}
      aria-hidden="true"
      data-testid="context-cursor"
      className="ctx-cursor"
      style={{ opacity: 0 }}
    >
      <span ref={text} />
    </div>
  );
}
