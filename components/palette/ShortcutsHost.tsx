"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { OPEN_HELP_EVENT, OPEN_PALETTE_EVENT, isTypingTarget, preloadPalette } from "@/lib/shortcuts";

const PaletteImpl = dynamic(() => import("./PaletteImpl"), { ssr: false });
const HelpImpl = dynamic(() => import("./HelpImpl"), { ssr: false });

type Overlay = "palette" | "help" | null;

/**
 * Always-mounted, tiny listener for global shortcuts. The palette and help overlay are
 * code-split and only fetched on first use (or on first user intent, via preloadPalette).
 */
export function ShortcutsHost() {
  const [open, setOpenState] = useState<Overlay>(null);
  const [loaded, setLoaded] = useState({ palette: false, help: false });
  const returnFocus = useRef<HTMLElement | null>(null);
  const openRef = useRef<Overlay>(null);

  const setOpen = useCallback((next: Overlay) => {
    openRef.current = next;
    setOpenState(next);
  }, []);

  const show = useCallback(
    (which: Exclude<Overlay, null>) => {
      if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
        returnFocus.current = document.activeElement;
      }
      setLoaded((l) => ({ ...l, [which]: true }));
      setOpen(which);
      if (which === "palette") track("palette_open");
    },
    [setOpen],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (openRef.current === "palette") setOpen(null);
        else show("palette");
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || isTypingTarget(e.target)) return;
      if (e.key === "/") {
        e.preventDefault();
        show("palette");
      } else if (e.key === "?") {
        e.preventDefault();
        show("help");
      }
    };
    const onOpenPalette = () => show("palette");
    const onOpenHelp = () => show("help");

    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpenPalette);
    window.addEventListener(OPEN_HELP_EVENT, onOpenHelp);
    // Warm the palette chunk on first sign of user intent (keeps it out of the load path).
    const warm = () => preloadPalette();
    window.addEventListener("pointermove", warm, { once: true, passive: true });
    window.addEventListener("touchstart", warm, { once: true, passive: true });
    window.addEventListener("keydown", warm, { once: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpenPalette);
      window.removeEventListener(OPEN_HELP_EVENT, onOpenHelp);
      window.removeEventListener("pointermove", warm);
      window.removeEventListener("touchstart", warm);
      window.removeEventListener("keydown", warm);
    };
  }, [show, setOpen]);

  const restoreFocus = useCallback((e: Event) => {
    e.preventDefault();
    returnFocus.current?.focus();
    returnFocus.current = null;
  }, []);

  return (
    <>
      {loaded.palette ? (
        <PaletteImpl
          open={open === "palette"}
          onOpenChange={(o) => setOpen(o ? "palette" : null)}
          onCloseAutoFocus={restoreFocus}
        />
      ) : null}
      {loaded.help ? (
        <HelpImpl
          open={open === "help"}
          onOpenChange={(o) => setOpen(o ? "help" : null)}
          onCloseAutoFocus={restoreFocus}
        />
      ) : null}
    </>
  );
}
