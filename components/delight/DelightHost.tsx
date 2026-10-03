"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { OPEN_GAME_EVENT, OPEN_TERMINAL_EVENT, konamiProgress } from "@/lib/delight";
import { isTypingTarget } from "@/lib/shortcuts";

const TerminalDialog = dynamic(() => import("@/components/terminal/TerminalDialog"), { ssr: false });
const CosmoStrikeDialog = dynamic(() => import("@/components/games/CosmoStrikeDialog"), { ssr: false });

type Overlay = "terminal" | "game" | null;

/**
 * Always-mounted and tiny: it only listens. The terminal and the game are separate chunks that are
 * fetched the first time they open (via `~`, the palette, the Konami code or the terminal itself).
 */
export function DelightHost() {
  const [open, setOpen] = useState<Overlay>(null);
  const [loaded, setLoaded] = useState({ terminal: false, game: false });
  const openRef = useRef<Overlay>(null);

  const show = useCallback((which: Exclude<Overlay, null>) => {
    openRef.current = which;
    setLoaded((l) => ({ ...l, [which]: true }));
    setOpen(which);
  }, []);
  const close = useCallback(() => {
    openRef.current = null;
    setOpen(null);
  }, []);

  useEffect(() => {
    let progress = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || isTypingTarget(e.target)) return;
      if (openRef.current) return;
      if (e.key === "~" || e.key === "`") {
        e.preventDefault();
        show("terminal");
        return;
      }
      progress = konamiProgress(progress, e.key);
      if (progress === 10) {
        progress = 0;
        track("easter_egg_found", { name: "konami" });
        show("game");
      }
    };
    const onTerminal = () => show("terminal");
    const onGame = () => show("game");
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_TERMINAL_EVENT, onTerminal);
    window.addEventListener(OPEN_GAME_EVENT, onGame);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_TERMINAL_EVENT, onTerminal);
      window.removeEventListener(OPEN_GAME_EVENT, onGame);
    };
  }, [show]);

  return (
    <>
      {loaded.terminal ? (
        <TerminalDialog open={open === "terminal"} onOpenChange={(o) => (o ? show("terminal") : close())} />
      ) : null}
      {loaded.game ? (
        <CosmoStrikeDialog open={open === "game"} onOpenChange={(o) => (o ? show("game") : close())} />
      ) : null}
    </>
  );
}
