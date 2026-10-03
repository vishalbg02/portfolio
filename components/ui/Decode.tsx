"use client";

import { useEffect, useRef, useState } from "react";
import { scramble } from "@/lib/utils/scramble";
import { cn } from "@/lib/utils/cn";

const DURATION_MS = 420;
const FRAME_MS = 34;

/**
 * Section labels and titles "decode": random mono glyphs settle into the real text the first time
 * they scroll into view. The real text is always in the DOM (screen readers, no-JS, search engines);
 * during the ~400 ms effect it is only visually covered by an aria-hidden overlay of the same size,
 * so nothing shifts. Under prefers-reduced-motion the final text is simply shown.
 */
export function Decode({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [frame, setFrame] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = 0;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / DURATION_MS);
        if (p >= 1) {
          setFrame(null);
          return;
        }
        if (now - last >= FRAME_MS) {
          last = now;
          setFrame(scramble(text, p));
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        run();
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [text]);

  return (
    <span
      ref={ref}
      className={cn("relative block", className)}
      data-decoding={frame === null ? undefined : ""}
    >
      <span className={frame === null ? undefined : "opacity-0"}>{text}</span>
      {frame === null ? null : (
        <span aria-hidden="true" className="absolute inset-0 overflow-hidden">
          {frame}
        </span>
      )}
    </span>
  );
}
