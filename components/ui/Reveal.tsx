"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Plays a one-shot CSS reveal when it scrolls into view. The markup is server-rendered in its final
 * state; with JS the island arms it (`data-reveal="armed"`) and then plays it (`"play"`) once. Not armed
 * at all under reduced motion, or when it is already on screen at load, so nothing is ever hidden.
 */
export function Reveal({
  children,
  className,
  threshold = 0.3,
}: {
  children: ReactNode;
  className?: string;
  threshold?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.85 && r.bottom > 0) return;
    el.dataset.reveal = "armed";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.dataset.reveal = "play";
        io.disconnect();
      },
      { threshold },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      delete el.dataset.reveal;
    };
  }, [threshold]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
