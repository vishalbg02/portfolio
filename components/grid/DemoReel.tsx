"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { clipAnswer, frameAt, sceneDuration, TOOL_WORKING, type DemoScene } from "@/lib/grid/demo";
import { AnswerText } from "./AnswerText";
import { PartView } from "./cards/PartView";
import { GridFace, type FaceState } from "./GridFace";

const TICK = 40;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * The Ask section's demo: a short loop of real exchanges (the router's actual answers) typed and "spoken" by GRID's
 * face, so a visitor sees what it does before asking anything. It is decorative to assistive tech (the stage is
 * aria-hidden and inert; a visually hidden caption carries the same example in text), pauses on demand, when
 * scrolled away or in a background tab, and is still (the settled last frame, next/previous by hand) under reduced motion.
 */
export function DemoReel({ scenes, onTry }: { scenes: DemoScene[]; onTry?: (question: string) => void }) {
  const [at, setAt] = useState({ i: 0, t: 0 });
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(prefersReducedMotion);
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const root = useRef<HTMLElement>(null);

  const scene = scenes[at.i] ?? scenes[0]!;
  const duration = sceneDuration(scene);
  const still = paused || reduced;
  const running = !still && inView && tabVisible;
  const frame = frameAt(scene, still ? duration : at.t);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(Boolean(e?.isIntersecting)), { threshold: 0.2 });
    io.observe(el);
    const vis = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", vis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(
      () =>
        setAt((s) => {
          const t = s.t + TICK;
          const d = sceneDuration(scenes[s.i] ?? scenes[0]!);
          return t >= d ? { i: (s.i + 1) % scenes.length, t: 0 } : { i: s.i, t };
        }),
      TICK,
    );
    return () => window.clearInterval(id);
  }, [running, scenes]);

  const face: FaceState =
    frame.phase === "type"
      ? "listening"
      : frame.phase === "think"
        ? "thinking"
        : frame.phase === "tool"
          ? "acting"
          : frame.phase === "answer"
            ? "speaking"
            : "idle";
  const answered = frame.phase === "answer" || frame.phase === "hold";
  const complete = frame.phase === "hold";
  const typing = frame.phase === "type";

  const go = (i: number) => setAt({ i: (i + scenes.length) % scenes.length, t: 0 });
  const summary = `Example. Asked: “${scene.q}”. GRID answers: ${scene.text
    .replace(/\[\d+\]/g, "")
    .replace(/\s+/g, " ")
    .trim()}${scene.sources.length > 0 ? ` Sources: ${scene.sources.map((s) => s.title).join("; ")}.` : ""}`;

  return (
    <figure ref={root} aria-label="An example conversation with GRID" className="m-0" data-demo-scene={at.i}>
      <div
        aria-hidden="true"
        inert
        className="demo-stage stage-grid relative h-[470px] overflow-hidden rounded-card border border-border p-3.5 sm:h-[430px]"
      >
        <p className="flex min-h-7 items-center gap-2 font-mono text-[13px] text-text">
          <span className="text-accent">›</span>
          <span data-testid="demo-question">{scene.q.slice(0, frame.typed)}</span>
          {typing ? <span className="grid-caret" /> : null}
        </p>

        <div key={at.i} className="mt-3 flex items-start gap-3">
          <GridFace state={face} size={30} className="mt-0.5" />
          <div className="min-w-0 flex-1 space-y-3">
            {frame.phase === "think" ? (
              <p className="font-mono text-xs text-muted">
                Thinking<span className="animate-blink">…</span>
              </p>
            ) : null}
            {frame.phase === "tool" && scene.tool ? (
              <p className="font-mono text-xs text-muted">
                <span className="mr-2 text-accent">▸</span>
                {TOOL_WORKING[scene.tool]}
                <span className="animate-blink">…</span>
              </p>
            ) : null}
            {answered && scene.parts.length > 0 ? (
              <div className="demo-in space-y-3">
                {scene.parts.map((p, n) => (
                  <PartView key={n} part={p} compact />
                ))}
              </div>
            ) : null}
            {answered ? (
              <div className="demo-in">
                <AnswerText text={clipAnswer(scene.text, frame.shown)} sources={scene.sources} />
                {complete && scene.sources.length > 0 ? (
                  <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 font-mono text-[11px] text-muted">
                    <span>Sources</span>
                    {scene.sources.map((s) => (
                      <span key={s.n} className="rounded-pill border border-border px-2.5 py-1 text-link">
                        [{s.n}] {s.title.length > 42 ? `${s.title.slice(0, 40)}…` : s.title}
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <figcaption className="sr-only">{summary}</figcaption>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-1">
          {!reduced ? (
            <button
              type="button"
              aria-pressed={paused}
              onClick={() => setPaused((p) => !p)}
              className="inline-flex min-h-8 items-center gap-2 rounded-sm px-2 font-mono text-xs text-muted transition-colors hover:text-text pointer-coarse:min-h-11"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                {paused ? <path d="M2 1l7 4-7 4z" /> : <path d="M2 1h2v8H2zM6 1h2v8H6z" />}
              </svg>
              {paused ? "Play demo" : "Pause demo"}
            </button>
          ) : null}
          <div role="group" aria-label="Choose an example" className="flex items-center">
            {scenes.map((s, n) => (
              <button
                key={s.q}
                type="button"
                aria-label={`Example ${n + 1} of ${scenes.length}: ${s.q}`}
                aria-current={n === at.i ? "true" : undefined}
                onClick={() => go(n)}
                className="group inline-flex size-8 items-center justify-center pointer-coarse:size-11"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2 rounded-[2px] transition-colors group-hover:bg-muted",
                    n === at.i ? "bg-accent" : "bg-border-2",
                  )}
                />
              </button>
            ))}
          </div>
        </div>
        {onTry ? (
          <button
            type="button"
            onClick={() => onTry(scene.q)}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-pill border border-border-2 px-3 font-mono text-xs text-text transition-colors hover:border-accent hover:text-accent pointer-coarse:min-h-11"
          >
            Ask this myself <span aria-hidden="true">→</span>
          </button>
        ) : null}
      </div>
    </figure>
  );
}
