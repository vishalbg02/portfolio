"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { createChord, stepSection } from "@/lib/keys";
import { OPEN_HELP_EVENT, isTypingTarget } from "@/lib/shortcuts";
import { shipped } from "@/lib/site";
import { startTour } from "@/lib/tour/events";

const HelpImpl = dynamic(() => import("./HelpImpl"), { ssr: false });

/** Moves to a section and puts keyboard focus on it, so a screen reader announces where you landed. */
function goTo(el: HTMLElement) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  if (!el.hasAttribute("tabindex")) el.tabIndex = -1;
  el.focus({ preventScroll: true });
}

/**
 * Always-mounted, tiny listener for the `?` help overlay and the page's keyboard navigation: `j` and `k` for the next
 * and previous section, `g` then a letter to jump to one, `t` for the tour. (⌘K and `/` belong to the Omnibar.) The
 * overlay is code-split and only fetched on first use.
 */
export function ShortcutsHost() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  const show = useCallback(() => {
    if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
      returnFocus.current = document.activeElement;
    }
    setLoaded(true);
    setOpen(true);
  }, []);

  useEffect(() => {
    const chord = createChord();
    // where the last j or k is heading, for a few moments: a second press while the page is still gliding goes one
    // further from there, instead of measuring from a half-scrolled page
    let heading: { index: number; at: number } | null = null;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || isTypingTarget(e.target)) return;
      if (e.key === "?") {
        e.preventDefault();
        show();
        return;
      }
      // not while a dialog (GRID, the terminal, help) has the keyboard
      if (document.querySelector("[role=dialog]")) return;
      const action = chord.feed(e.key, performance.now());
      if (!action) return;
      if (action.type === "tour") {
        if (shipped.tour) startTour();
        return;
      }
      const sections = [...document.querySelectorAll<HTMLElement>("main > section")];
      if (action.type === "goto") {
        e.preventDefault();
        const target = action.id ? document.getElementById(action.id) : null;
        if (action.id && !target) {
          window.location.assign(new URL(`/#${action.id}`, window.location.origin).href); // another page: go home, to that section
        } else if (target) goTo(target);
        else window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (sections.length === 0) return;
      // a section that has been scrolled to sits under the sticky nav (scroll-padding-top), so measure from there
      const offset = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const dir = action.type === "next" ? 1 : -1;
      const now = performance.now();
      let i: number | null;
      if (heading && now - heading.at < 900) {
        const to = heading.index + dir;
        i = to >= 0 && to < sections.length ? to : null;
      } else {
        i = stepSection(
          sections.map((el) => el.getBoundingClientRect().top - offset),
          dir,
        );
      }
      if (i !== null) {
        e.preventDefault();
        heading = { index: i, at: now };
        goTo(sections[i]!);
      } else if (action.type === "prev") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_HELP_EVENT, show);
    // Deterministic "listeners are attached" signal (tests wait on it instead of guessing at timing).
    document.documentElement.dataset.shortcuts = "ready";
    return () => {
      delete document.documentElement.dataset.shortcuts;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_HELP_EVENT, show);
    };
  }, [show]);

  const restoreFocus = useCallback((e: Event) => {
    e.preventDefault();
    returnFocus.current?.focus();
    returnFocus.current = null;
  }, []);

  return loaded ? <HelpImpl open={open} onOpenChange={setOpen} onCloseAutoFocus={restoreFocus} /> : null;
}
