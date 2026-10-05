"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { isTypingTarget } from "@/lib/shortcuts";

const LateHosts = dynamic(() => import("./LateHosts"), { ssr: false });

/** Keys only the late hosts answer (help, terminal, sections, jump, tour). Others already reached their listeners. */
const LATE_KEYS = ["?", "~", "`", "j", "k", "g", "t"];

/**
 * Keeps six always-mounted listeners out of the first load (1.9 KB gzip of the home page's initial JS, measured, all of
 * it requested before the first paint). They arrive as one chunk when the browser is idle after load, or at the first
 * key press, touch or click, whichever comes first. A single-key shortcut pressed before then is replayed.
 */
export function IdleHosts() {
  const [on, setOn] = useState<{ replay: string | null } | null>(null);

  useEffect(() => {
    const idle = "requestIdleCallback" in window; // not in older Safari
    let done = false;
    const go = (replay: string | null) => {
      if (done) return;
      done = true;
      setOn({ replay });
    };
    const onKey = (e: KeyboardEvent) => {
      const plain = !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target);
      go(plain && LATE_KEYS.includes(e.key) ? e.key : null);
    };
    const onPointer = () => go(null);
    const id = idle ? window.requestIdleCallback(() => go(null), { timeout: 1500 }) : 0;
    const t = idle ? 0 : window.setTimeout(() => go(null), 1200);
    window.addEventListener("keydown", onKey, { capture: true });
    window.addEventListener("pointerdown", onPointer, { capture: true, passive: true });
    return () => {
      if (id) window.cancelIdleCallback(id);
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey, { capture: true });
      window.removeEventListener("pointerdown", onPointer, { capture: true });
    };
  }, []);

  return on ? <LateHosts replay={on.replay} /> : null;
}
