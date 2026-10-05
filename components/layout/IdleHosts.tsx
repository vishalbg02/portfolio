"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { OPEN_GAME_EVENT, OPEN_TERMINAL_EVENT } from "@/lib/delight";
import { OPEN_HELP_EVENT, isTypingTarget } from "@/lib/shortcuts";
import { START_TOUR_EVENT } from "@/lib/tour/events";

const LateHosts = dynamic(() => import("./LateHosts"), { ssr: false });

/** Keys only the late hosts answer (help, terminal, sections, jump, tour). Others already reached their listeners. */
const LATE_KEYS = ["?", "~", "`", "j", "k", "g", "t"];
/** Requests other parts of the page send to the late hosts (GRID starting the tour, the palette opening the terminal). */
const LATE_EVENTS = [START_TOUR_EVENT, OPEN_HELP_EVENT, OPEN_TERMINAL_EVENT, OPEN_GAME_EVENT];

export type Replay = { key: string } | { event: string };

/**
 * Keeps six always-mounted listeners out of the first load (1.9 KB gzip of the home page's initial JS, measured, all of
 * it requested before the first paint). They arrive as one chunk when the browser is idle after load, or at the first
 * key press, touch or click, whichever comes first. Shortcut keys pressed and requests sent to them (start the tour,
 * open the terminal) before they are listening are queued and replayed in order, so nothing is lost.
 */
export function IdleHosts() {
  const [on, setOn] = useState(false);
  const ready = useRef(false);
  const pending = useRef<Replay[]>([]);

  useEffect(() => {
    const idle = "requestIdleCallback" in window; // not in older Safari
    const go = (replay: Replay | null) => {
      if (ready.current) return; // the hosts hear it themselves now
      if (replay) pending.current.push(replay);
      setOn(true);
    };
    const onKey = (e: KeyboardEvent) => {
      const plain = !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target);
      go(plain && LATE_KEYS.includes(e.key) ? { key: e.key } : null);
    };
    const onEvent = (e: Event) => go({ event: e.type });
    const onPointer = () => go(null);
    const id = idle ? window.requestIdleCallback(() => go(null), { timeout: 1500 }) : 0;
    const t = idle ? 0 : window.setTimeout(() => go(null), 1200);
    window.addEventListener("keydown", onKey, { capture: true });
    window.addEventListener("pointerdown", onPointer, { capture: true, passive: true });
    for (const name of LATE_EVENTS) window.addEventListener(name, onEvent);
    return () => {
      for (const name of LATE_EVENTS) window.removeEventListener(name, onEvent);
      if (id) window.cancelIdleCallback(id);
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey, { capture: true });
      window.removeEventListener("pointerdown", onPointer, { capture: true });
    };
  }, []);

  /** Called by LateHosts once its listeners are attached: from now on they hear everything themselves. */
  const handOver = useCallback(() => {
    ready.current = true;
    const queued = pending.current;
    pending.current = [];
    return queued;
  }, []);

  return on ? <LateHosts handOver={handOver} /> : null;
}
