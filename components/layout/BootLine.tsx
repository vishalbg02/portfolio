"use client";

import { useEffect, useState } from "react";
import { BOOT_MS, shouldBoot } from "@/lib/boot";

/**
 * "booting vishalbg… ok": a half-second mono line beside the wordmark, first visit of a session only.
 * It starts after the page has loaded and the browser is idle (so it can't touch LCP or delay anything),
 * is absolutely positioned (no layout shift), decorative, and skipped under reduced motion.
 */
export function BootLine() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let hide = 0;
    let idle = 0;
    const start = () => {
      let storage: Storage | null = null;
      try {
        storage = window.sessionStorage;
      } catch {
        /* blocked */
      }
      if (!shouldBoot(storage, window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
      setShow(true);
      hide = window.setTimeout(() => setShow(false), BOOT_MS);
    };
    const schedule = () => {
      idle = window.setTimeout(start, 150);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      window.clearTimeout(idle);
      window.clearTimeout(hide);
    };
  }, []);

  if (!show) return null;
  return (
    <span
      aria-hidden="true"
      data-testid="boot-line"
      className="pointer-events-none absolute top-1/2 left-full ml-4 hidden -translate-y-1/2 font-mono text-xs whitespace-nowrap text-muted sm:block"
    >
      booting vishalbg… <span className="text-accent">ok</span>
    </span>
  );
}
