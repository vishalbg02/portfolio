"use client";

import { useEffect, useRef } from "react";
import { TrailField, levelFor } from "@/lib/hero/trail";

const CELL = 14;
const GAP = 4;
const PITCH = CELL + GAP;
const MAX_DPR = 2;

/**
 * Full-hero canvas of faint contribution squares (14px, 4px gap). Squares near the pointer
 * light up through --grid-1…4 and fade back over ~600ms; touch taps send a ripple.
 * The rAF loop only runs while something is animating, and pauses when off-screen.
 */
export default function TrailCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !host || !ctx) return;

    const css = getComputedStyle(document.documentElement);
    const palette = [0, 1, 2, 3, 4].map((i) => css.getPropertyValue(`--grid-${i}`).trim() || "#161b22");

    let field = new TrailField(1, 1);
    let raf = 0;
    let last = 0;
    let visible = true;
    let dpr = 1;

    const drawCell = (index: number, level: number) => {
      const x = (index % field.cols) * PITCH;
      const y = Math.floor(index / field.cols) * PITCH;
      ctx.fillStyle = palette[level]!;
      ctx.beginPath();
      ctx.roundRect(x, y, CELL, CELL, 2);
      ctx.fill();
    };

    const drawAll = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < field.cols * field.rows; i++) drawCell(i, 0);
    };

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w === 0 || h === 0) return;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.ceil(w * dpr);
      canvas.height = Math.ceil(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      field = new TrailField(Math.ceil((w + GAP) / PITCH), Math.ceil((h + GAP) / PITCH));
      drawAll();
    };

    const frame = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      for (const i of field.step(dt, now))
        drawCell(i, levelFor(field.intensityAt(i % field.cols, Math.floor(i / field.cols))));
      raf = field.idle || !visible ? 0 : requestAnimationFrame(frame);
    };

    const kick = () => {
      if (raf || !visible) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const toCell = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left) / PITCH, (e.clientY - r.top) / PITCH] as const;
    };

    const onMove = (e: PointerEvent) => {
      if (!visible || e.pointerType === "touch") return;
      field.stamp(...toCell(e));
      kick();
    };
    const onDown = (e: PointerEvent) => {
      if (!visible || e.pointerType === "mouse") return;
      field.ripple(...toCell(e), performance.now());
      kick();
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) kick();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    const ro = new ResizeObserver(resize);

    resize();
    io.observe(host);
    ro.observe(host);
    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerdown", onDown, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      data-testid="hero-trail"
      className="pointer-events-none absolute inset-0 z-0 animate-fade-in"
    />
  );
}
