"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const TrailCanvas = dynamic(() => import("./TrailCanvas"), { ssr: false });

/**
 * Mounts the cursor-trail canvas only after the browser is idle, so the server-rendered
 * hero text (the LCP element) is never competing with it. Never mounts under reduced motion.
 */
export function TrailLoader() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback && w.cancelIdleCallback) {
      const id = w.requestIdleCallback(() => setReady(true), { timeout: 2000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setReady(true), 1200);
    return () => window.clearTimeout(id);
  }, []);

  return ready ? <TrailCanvas /> : null;
}
