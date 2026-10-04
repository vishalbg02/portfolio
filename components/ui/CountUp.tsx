"use client";

import { useEffect, useRef } from "react";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/**
 * A number that counts up from 0 the first time it scrolls into view (900 ms, ease-out). The final
 * value is in the markup from the start (no JS, reduced motion and screen readers all see it), and
 * the animation only rewrites the text node's content. Later changes to `value` (e.g. switching year)
 * show immediately, with no count.
 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const played = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = fmt(value); // a new value always shows at once (the animation only plays the first time)
    if (played.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        played.current = true;
        const t0 = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - t0) / 900);
          el.textContent = fmt(value * (1 - (1 - p) ** 3));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);

  // innerHTML keeps React away from the text node the animation rewrites; changing `value` resets it.
  return <span ref={ref} className={className} dangerouslySetInnerHTML={{ __html: fmt(value) }} />;
}
