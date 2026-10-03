"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const PLAY_MS = 6500;

/**
 * Lets a code-drawn sketch (server-rendered) move on touch devices too: it plays once when the card
 * scrolls into view, again on tap, then idles. Hover/focus is handled in CSS (styles/sketches.css).
 * Reduced motion is handled globally (animations are effectively skipped).
 */
export function SketchPlayer({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  const play = () => {
    setPlaying(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPlaying(false), PLAY_MS);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          play();
          io.disconnect(); // once per view
        }
      },
      { threshold: 0.55 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <div ref={ref} data-sketch-play={playing} onPointerDown={play}>
      {children}
    </div>
  );
}
