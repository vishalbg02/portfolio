"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Gentle pointer-follow tilt for the stage (fine pointers only, never under reduced motion). */
export function Tilt({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const stage = el?.closest<HTMLElement>(".stage-grid") ?? el?.parentElement;
    if (!el || !stage) return;
    if (
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    let raf = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = stage.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 7).toFixed(2)}deg)`;
      });
    };
    const leave = () => {
      cancelAnimationFrame(raf);
      el.style.transform = "";
    };
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <div ref={ref} className="transition-transform duration-200 ease-out will-change-transform">
      {children}
    </div>
  );
}
