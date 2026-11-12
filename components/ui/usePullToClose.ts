"use client";

import { useRef, useState, type PointerEvent } from "react";

/**
 * A phone sheet's drag handle: pull it down past `threshold` px and the sheet closes; let go sooner and it springs back.
 * Returns the handle's pointer props and the current offset (to translate the sheet by). Keyboard and screen-reader
 * users close the sheet with its close button; the handle itself is decorative (aria-hidden).
 */
export function usePullToClose(onClose: () => void, threshold = 120) {
  const start = useRef<number | null>(null);
  const [dy, setDy] = useState(0);
  const reset = () => {
    start.current = null;
    setDy(0);
  };
  const handle = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      start.current = e.clientY;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (start.current !== null) setDy(Math.max(0, e.clientY - start.current));
    },
    onPointerUp: () => {
      const pulled = start.current !== null && dy > threshold;
      reset();
      if (pulled) {
        navigator.vibrate?.(8);
        onClose();
      }
    },
    onPointerCancel: reset,
  };
  return { handle, dy };
}

/** The handle's look: five small squares, the system's atom. */
export const PULL_HANDLE_CLASS =
  "flex h-5 shrink-0 cursor-grab touch-none items-center justify-center gap-[3px]";
