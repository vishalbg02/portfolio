"use client";

import { useEffect, useState } from "react";
import { openGrid } from "@/lib/grid/events";

type Bubble = { x: number; y: number; below: boolean; text: string };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Select a sentence on the page and an "Ask GRID" bubble appears next to it. Mouse and trackpad only: on a phone
 * the system's own selection menu sits in the same place. Ignores form fields, dialogs and the chat itself.
 */
export function SelectionAsk() {
  const [bubble, setBubble] = useState<Bubble | null>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      const sel = window.getSelection();
      const text = sel?.toString().replace(/\s+/g, " ").trim() ?? "";
      const host = sel?.anchorNode?.parentElement;
      if (!sel || sel.isCollapsed || text.length < 12 || text.length > 280 || !host) return setBubble(null);
      if (!host.closest("main") || host.closest("input, textarea, [contenteditable], [role=dialog]"))
        return setBubble(null);
      const r = sel.getRangeAt(0).getBoundingClientRect();
      const below = r.top < 56;
      setBubble({
        x: clamp(r.left + r.width / 2, 64, window.innerWidth - 64),
        y: below ? r.bottom + 8 : r.top - 8,
        below,
        text,
      });
    };
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(check, 160);
    };
    const hide = () => setBubble(null);
    document.addEventListener("selectionchange", onChange);
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", onChange);
      window.removeEventListener("scroll", hide);
    };
  }, []);

  if (!bubble) return null;
  return (
    <button
      type="button"
      // keep the selection alive while the button is pressed
      onPointerDown={(e) => e.preventDefault()}
      onClick={() => {
        openGrid({ question: `Tell me more about this, from his site: “${bubble.text}”` });
        window.getSelection()?.removeAllRanges();
        setBubble(null);
      }}
      style={{ left: bubble.x, top: bubble.y }}
      className={
        "fixed z-[60] -translate-x-1/2 rounded-sm border border-accent bg-surface px-2.5 py-1 font-mono text-xs text-accent " +
        "hover:bg-accent hover:text-bg " +
        (bubble.below ? "" : "-translate-y-full")
      }
    >
      <span aria-hidden="true">? </span>Ask GRID
    </button>
  );
}
