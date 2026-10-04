"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { OPEN_HELP_EVENT, isTypingTarget } from "@/lib/shortcuts";

const HelpImpl = dynamic(() => import("./HelpImpl"), { ssr: false });

/**
 * Always-mounted, tiny listener for the `?` help overlay. (⌘K and `/` belong to the Omnibar.) The overlay is
 * code-split and only fetched on first use.
 */
export function ShortcutsHost() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  const show = useCallback(() => {
    if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
      returnFocus.current = document.activeElement;
    }
    setLoaded(true);
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || isTypingTarget(e.target)) return;
      if (e.key === "?") {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_HELP_EVENT, show);
    // Deterministic "listeners are attached" signal (tests wait on it instead of guessing at timing).
    document.documentElement.dataset.shortcuts = "ready";
    return () => {
      delete document.documentElement.dataset.shortcuts;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_HELP_EVENT, show);
    };
  }, [show]);

  const restoreFocus = useCallback((e: Event) => {
    e.preventDefault();
    returnFocus.current?.focus();
    returnFocus.current = null;
  }, []);

  return loaded ? <HelpImpl open={open} onOpenChange={setOpen} onCloseAutoFocus={restoreFocus} /> : null;
}
