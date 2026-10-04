"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Kbd } from "@/components/palette/Kbd";
import { useIsMac } from "@/components/palette/useIsMac";
import { track } from "@/lib/analytics";
import { OPEN_OMNIBAR_EVENT } from "@/lib/grid/events";
import { isTypingTarget } from "@/lib/shortcuts";
import { shipped } from "@/lib/site";
import { GridFace } from "./GridFace";

const loadPanel = () => import("./OmnibarPanel");
const OmnibarPanel = dynamic(loadPanel, { ssr: false });

/** What it suggests, in turn. "Message Vishal…" only appears once live chat actually ships. */
const HINTS = [
  "Ask about my Spring Boot work…",
  "Paste a job description…",
  ...(shipped.liveChat ? ["Message Vishal…"] : []),
];

/**
 * The persistent bar at the bottom of the page (desktop): one input for commands and questions. This is only the
 * pill and the keys (⌘K, `/`); the panel itself is a separate chunk, fetched on first intent. On a phone the dock's
 * GRID button does this job.
 */
export function Omnibar() {
  const isMac = useIsMac();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [prefill, setPrefill] = useState("");
  const [hint, setHint] = useState(0);
  const [still, setStill] = useState(false);
  const pill = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const openRef = useRef(false);
  /** False until the panel is on screen; keys typed in that gap are kept and handed over, never lost. */
  const panelReady = useRef(false);
  /** Enter pressed in that same gap: applied as soon as the panel is up. */
  const pendingEnter = useRef(false);

  const show = useCallback((text = "") => {
    const active = document.activeElement;
    returnFocus.current = active instanceof HTMLElement && active !== document.body ? active : pill.current;
    panelReady.current = false;
    pendingEnter.current = false;
    setPrefill(text);
    setLoaded(true);
    openRef.current = true;
    setOpen(true);
    track("omnibar_open");
  }, []);
  const markReady = useCallback(() => {
    panelReady.current = true;
    if (!pendingEnter.current) return;
    pendingEnter.current = false;
    // let the rows render and the first one highlight, then press Enter for the visitor
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() =>
        document
          .querySelector("[cmdk-input]")
          ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })),
      ),
    );
  }, []);
  const setOpenSynced = useCallback((o: boolean) => {
    openRef.current = o;
    setOpen(o);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (openRef.current && !panelReady.current && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key.length === 1) {
          e.preventDefault();
          setPrefill((t) => t + e.key);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          pendingEnter.current = true;
          return;
        }
        if (e.key === "Backspace") {
          e.preventDefault();
          setPrefill((t) => t.slice(0, -1));
          return;
        }
      }
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (openRef.current) setOpenSynced(false);
        else show();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || isTypingTarget(e.target)) return;
      if (e.key === "/") {
        e.preventDefault();
        show();
      }
    };
    const onOpen = (e: Event) => show((e as CustomEvent<{ prefill?: string }>).detail?.prefill ?? "");
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_OMNIBAR_EVENT, onOpen);
    const warm = () => void loadPanel();
    window.addEventListener("pointermove", warm, { once: true, passive: true });
    window.addEventListener("touchstart", warm, { once: true, passive: true });
    window.addEventListener("keydown", warm, { once: true });
    document.documentElement.dataset.omnibar = "ready"; // tests wait on this instead of guessing at timing
    return () => {
      delete document.documentElement.dataset.omnibar;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_OMNIBAR_EVENT, onOpen);
      window.removeEventListener("pointermove", warm);
      window.removeEventListener("touchstart", warm);
      window.removeEventListener("keydown", warm);
    };
  }, [show, setOpenSynced]);

  // The suggestion changes every few seconds; with reduced motion, or while you point at it, it holds still.
  useEffect(() => {
    if (still || HINTS.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setHint((i) => (i + 1) % HINTS.length), 4200);
    return () => window.clearInterval(t);
  }, [still]);

  return (
    <>
      <div className="omnibar needs-grid pointer-events-none fixed inset-x-0 bottom-5 z-40 hidden justify-center md:flex">
        <button
          ref={pill}
          type="button"
          aria-haspopup="dialog"
          aria-label="Ask GRID or run a command"
          aria-keyshortcuts="Control+K Meta+K /"
          onClick={() => show()}
          onPointerEnter={() => {
            setStill(true);
            void loadPanel();
          }}
          onPointerLeave={() => setStill(false)}
          onFocus={() => {
            setStill(true);
            void loadPanel();
          }}
          onBlur={() => setStill(false)}
          className="pointer-events-auto flex h-12 w-[min(520px,calc(100vw-48px))] items-center gap-3 rounded-pill border border-border-2 bg-surface pr-3 pl-4 text-left transition-colors hover:border-accent focus-visible:border-accent"
        >
          <GridFace state="idle" size={22} label="" />
          <span
            aria-hidden="true"
            key={hint}
            className="omni-hint min-w-0 flex-1 truncate text-sm text-muted"
          >
            {HINTS[hint]}
          </span>
          <span aria-hidden="true" className="flex gap-1">
            <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
      </div>
      {loaded ? (
        <OmnibarPanel
          open={open}
          onOpenChange={setOpenSynced}
          prefill={prefill}
          onReady={markReady}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnFocus.current?.focus();
            returnFocus.current = null;
          }}
        />
      ) : null}
    </>
  );
}
