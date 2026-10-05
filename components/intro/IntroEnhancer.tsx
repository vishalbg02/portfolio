"use client";

import { useEffect, useRef, useState } from "react";
import { GridFace } from "@/components/grid/GridFace";
import { track } from "@/lib/analytics";
import { openGrid } from "@/lib/grid/events";
import { play } from "@/lib/sound";
import { startTour } from "@/lib/tour/events";

const GREETED = "intro:greeted";
/** When the greeting appears: as the hand-over ends (1.5 s; 1.1 s on a phone). It stays 6 s. */
const AT_MS = { wide: 1500, phone: 1100 };
const STAY_MS = 6000;

/**
 * The part of the opening sequence that needs JavaScript (docs/INTRO.md), loaded only when it played:
 *  - analytics: intro_played (not for a replay), intro_skipped (with how long it ran), intro_greeting_click;
 *  - GRID's one-time greeting by its new home (the Omnibar; the dock on a phone), with Ask GRID and Take the tour.
 *    It goes after 6 s or at any interaction, and never comes back in the same session. A personal company link
 *    (?c=) has its own banner, so it gets no greeting.
 *  - a chime with the greeting, only if sound is on AND the visitor has already interacted on this page (the audio
 *    context only runs after a gesture: lib/sound.ts), never otherwise.
 */
export default function IntroEnhancer() {
  const [show, setShow] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // analytics
  useEffect(() => {
    const html = document.documentElement;
    const replay = html.hasAttribute("data-intro-replay");
    if (!replay) track("intro_played");
    const skipped = () => {
      const ms = (window as Window & { __introSkippedAt?: number }).__introSkippedAt;
      if (typeof ms === "number") track("intro_skipped", { ms: String(ms), replay: String(replay) });
    };
    if (html.dataset.intro === "done") return skipped();
    const mo = new MutationObserver(() => {
      if (html.dataset.intro === "done") {
        skipped();
        mo.disconnect();
      } else if (html.dataset.intro === "ended") mo.disconnect();
    });
    mo.observe(html, { attributes: true, attributeFilter: ["data-intro"] });
    return () => mo.disconnect();
  }, []);

  // the greeting: once per session
  useEffect(() => {
    const html = document.documentElement;
    if (html.hasAttribute("data-intro-quiet")) return;
    try {
      if (sessionStorage.getItem(GREETED)) return;
      sessionStorage.setItem(GREETED, "1");
    } catch {
      /* blocked: it shows this once anyway */
    }
    const at = window.matchMedia("(min-width: 768px)").matches ? AT_MS.wide : AT_MS.phone;
    const t = window.setTimeout(() => {
      setShow(true);
      play("chime");
    }, at);
    return () => window.clearTimeout(t);
  }, []);

  // it goes by itself, or at any interaction outside it
  useEffect(() => {
    if (!show) return;
    const close = () => setShow(false);
    const t = window.setTimeout(close, STAY_MS);
    const outside = (e: Event) => {
      if (!box.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || !box.current?.contains(e.target as Node)) close();
    };
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("wheel", close, { passive: true });
    window.addEventListener("scroll", close, { passive: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("wheel", close);
      window.removeEventListener("scroll", close);
    };
  }, [show]);

  if (!show) return null;
  const choose = (choice: "ask" | "tour") => {
    track("intro_greeting_click", { choice });
    setShow(false);
    if (choice === "ask") openGrid({});
    else startTour();
  };
  return (
    <div
      ref={box}
      role="status"
      aria-live="polite"
      className="intro-greeting px-shadow"
      data-intro-greeting=""
    >
      <div className="flex items-start gap-3">
        <GridFace state="speaking" size={20} className="mt-0.5" />
        <p className="min-w-0 flex-1 text-sm text-text">
          Hi, I&apos;m GRID, Vishal&apos;s AI. Ask me anything, or take the 60-second tour.
        </p>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setShow(false)}
          className="-mt-1 -mr-1 grid size-7 shrink-0 place-items-center rounded-sm text-muted hover:text-text pointer-coarse:size-11"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 pl-8">
        <button type="button" className="intro-chip intro-chip-on" onClick={() => choose("ask")}>
          Ask GRID
        </button>
        <button type="button" className="intro-chip" onClick={() => choose("tour")}>
          Take the tour
        </button>
      </div>
    </div>
  );
}
