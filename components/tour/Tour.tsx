"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STOP_SECONDS, TOUR } from "@/content/tour";
import { profile } from "@/content/profile";
import { GridFace } from "@/components/grid/GridFace";
import { unlock } from "@/lib/achievements";
import { track } from "@/lib/analytics";
import { openGrid, openLive } from "@/lib/grid/events";
import { isTypingTarget } from "@/lib/shortcuts";
import { TOUR_STEP_EVENT, type TourStepDetail } from "@/lib/tour/events";
import { cn } from "@/lib/utils/cn";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const speechOk = () => typeof window !== "undefined" && "speechSynthesis" in window;

const ctl =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-sm border border-border px-2.5 font-mono text-xs text-text transition-colors hover:border-border-2 pointer-coarse:min-h-11";

/**
 * The guided tour: scrolls down the home page one stop at a time, outlines the stop's heading and shows a caption
 * while GRID's face "speaks". It starts playing (each stop stays 10 s) unless the visitor prefers reduced motion, when it
 * waits for them to press Next. Pause, Previous, Next and Exit are buttons and keys (Space, ← →, Esc). Spoken
 * captions are optional and off. Loaded only when the tour starts.
 */
export default function Tour({ onExit }: { onExit: () => void }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(() => !reducedMotion());
  const [voice, setVoice] = useState(false);
  const [finished, setFinished] = useState(false);
  const stop = TOUR[i]!;
  const caption = stop.caption(profile);
  const last = i === TOUR.length - 1;
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setFinished(true);
    setPlaying(false);
    unlock("tour");
    track("tour_complete");
  }, []);

  const exit = useCallback(() => {
    window.speechSynthesis?.cancel();
    window.dispatchEvent(
      new CustomEvent<TourStepDetail>(TOUR_STEP_EVENT, {
        detail: { index: -1, total: TOUR.length, sectionId: null },
      }),
    );
    onExit();
  }, [onExit]);

  const go = useCallback(
    (to: number) => {
      if (to < 0) return;
      if (to >= TOUR.length) return finish();
      setFinished(false);
      setI(to);
    },
    [finish],
  );

  // scroll to the stop, outline its heading, tell the Grid Rail where we are
  useEffect(() => {
    const section = stop.sectionId
      ? document.getElementById(stop.sectionId)
      : document.querySelector("main > section");
    if (!section) return;
    section.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    const target = section.matches(stop.highlight)
      ? section
      : section.querySelector<HTMLElement>(stop.highlight);
    target?.setAttribute("data-tour-hit", "");
    window.dispatchEvent(
      new CustomEvent<TourStepDetail>(TOUR_STEP_EVENT, {
        detail: { index: i, total: TOUR.length, sectionId: stop.sectionId },
      }),
    );
    return () => target?.removeAttribute("data-tour-hit");
  }, [i, stop]);

  // on to the next stop after STOP_SECONDS while playing; the last stop ends the tour
  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => (last ? finish() : go(i + 1)), STOP_SECONDS * 1000);
    return () => window.clearTimeout(t);
  }, [playing, i, last, go, finish]);

  // optional spoken captions
  useEffect(() => {
    if (!voice || !speechOk()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(caption);
    u.lang = "en-IN";
    u.rate = 1;
    window.speechSynthesis.speak(u);
    return () => window.speechSynthesis.cancel();
  }, [voice, caption]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        e.preventDefault();
        exit();
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(i + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(i - 1);
      } else if (e.key === " " && !(e.target instanceof HTMLElement && e.target.closest("button, a"))) {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exit, go, i]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  // while the tour is up the Omnibar steps aside (they would sit on top of each other)
  useEffect(() => {
    document.documentElement.dataset.tourActive = "";
    return () => {
      delete document.documentElement.dataset.tourActive;
    };
  }, []);

  return (
    <section
      aria-label="Guided tour"
      data-testid="tour"
      data-step={i}
      className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[65] rounded-card border border-border-2 bg-surface p-4 shadow-none md:inset-x-auto md:bottom-6 md:left-6 md:w-[min(440px,calc(100vw-3rem))]"
    >
      <div className="flex items-start gap-3">
        <GridFace state={playing && !finished ? "speaking" : "idle"} size={32} className="mt-0.5" />
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">
            {finished ? "That's the tour" : `Stop ${i + 1} of ${TOUR.length} · ${stop.title}`}
          </p>
          <p className="mt-1.5 text-[15px] leading-snug text-text" data-testid="tour-caption">
            {finished ? "Ask GRID anything, or message Vishal directly." : caption}
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-1" aria-hidden="true">
        {TOUR.map((s, n) => (
          <span
            key={s.id}
            className={cn(
              "h-1 flex-1 rounded-[1px]",
              n < i || finished ? "bg-accent" : n === i ? "bg-grid-3" : "bg-border",
            )}
          />
        ))}
      </div>
      {playing && !finished ? (
        <div aria-hidden="true" className="mt-1 h-px overflow-hidden bg-border">
          <span
            key={i}
            className="tour-progress block h-full origin-left bg-accent"
            style={{ animationDuration: `${STOP_SECONDS}s` }}
          />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {finished ? (
          <>
            <button type="button" className={ctl} onClick={() => (exit(), openGrid())}>
              Ask GRID
            </button>
            <button type="button" className={ctl} onClick={() => (exit(), openLive())}>
              Message Vishal
            </button>
            <button type="button" className={ctl} onClick={() => go(0)}>
              Again
            </button>
            <button type="button" className={cn(ctl, "ml-auto")} onClick={exit}>
              Close
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={ctl}
              onClick={() => go(i - 1)}
              disabled={i === 0}
              aria-label="Previous stop"
            >
              ←
            </button>
            <button
              type="button"
              className={ctl}
              onClick={() => setPlaying((p) => !p)}
              aria-pressed={!playing}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              className={ctl}
              onClick={() => go(i + 1)}
              aria-label={last ? "Finish" : "Next stop"}
            >
              {last ? "Finish" : "→"}
            </button>
            {speechOk() ? (
              <button type="button" className={ctl} aria-pressed={voice} onClick={() => setVoice((v) => !v)}>
                Voice {voice ? "on" : "off"}
              </button>
            ) : null}
            <button type="button" className={cn(ctl, "ml-auto")} onClick={exit}>
              Exit <span className="text-muted">Esc</span>
            </button>
          </>
        )}
      </div>
    </section>
  );
}
