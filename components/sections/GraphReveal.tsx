"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Draws the career graph once, top to bottom (~900 ms), when it scrolls into view. The markup is
 * server-rendered in its final state, so with no JS, or reduced motion, or the graph already on
 * screen at load, nothing is hidden. The attribute is set on the DOM directly (React never owns it).
 */
export function GraphReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.6) return;
    el.dataset.graph = "armed";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.dataset.graph = "play";
        io.disconnect();
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      delete el.dataset.graph; // leave the final state if the effect is torn down mid-way
    };
  }, []);

  return <div ref={ref}>{children}</div>;
}
