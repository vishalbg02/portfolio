"use client";

import { useEffect, useState } from "react";
import {
  BEAT_MS,
  CELLS,
  COLS,
  MAX_BEATING_MS,
  ROWS,
  cellFor,
  hereLabel,
  type HereView,
} from "@/lib/presence/wall";
import { cn } from "@/lib/utils/cn";

const KEY = "here:v1";

/** A random id for this tab: it decides which square lights. Not a cookie, never sent anywhere but /api/here. */
function visitorId(): string {
  try {
    const have = sessionStorage.getItem(KEY);
    if (have && /^[a-z0-9]{10,24}$/.test(have)) return have;
  } catch {
    /* blocked: an id for this page view only */
  }
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const id = Array.from(bytes, (b) => (b % 36).toString(36)).join("");
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
  return id;
}

/**
 * Who is here right now, as a wall of contribution squares: each visitor lights one (yours is outlined). A visible tab
 * sends a heartbeat every 30 seconds, starting a few seconds after the page is up, and stops after 30 minutes. Without
 * Redis on the server the wall simply stays dim. The grid keeps one shape in every state (loading, dim, live), so
 * nothing moves when the answer arrives. Anonymous: only the random id is sent.
 */
export function PresenceWall() {
  const [view, setView] = useState<HereView | null>(null);
  const [me, setMe] = useState<number | null>(null);

  useEffect(() => {
    const id = visitorId();
    const started = Date.now();
    let timer = 0;
    let stopped = false;
    const stop = () => {
      stopped = true;
      window.clearInterval(timer);
    };
    const beat = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      if (Date.now() - started > MAX_BEATING_MS) return stop();
      try {
        const res = await fetch("/api/here", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ v: id }),
        });
        if (!res.ok) return;
        const next = (await res.json()) as HereView;
        setView(next);
        setMe(cellFor(id)); // your own square (only once the wall is live, so a server render and the first client render agree)
        if (!next.configured) stop(); // nowhere to count: leave the wall dim
      } catch {
        /* offline: try again next time */
      }
    };
    const first = window.setTimeout(() => {
      void beat();
      timer = window.setInterval(() => void beat(), BEAT_MS);
    }, 2500);
    const onVisible = () => document.visibilityState === "visible" && void beat();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(first);
      stop();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const lit = new Set(view?.cells ?? []);
  return (
    <div data-testid="here-wall" className="w-full max-w-[360px]">
      <p className="mb-2 min-h-4 font-mono text-xs text-muted">
        {view?.configured ? hereLabel(view.count) : "Visitor wall"}
      </p>
      <div
        aria-hidden="true"
        className="grid gap-[3px]"
        style={{
          gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
          gridAutoFlow: "column",
          aspectRatio: `${COLS} / ${ROWS}`,
        }}
      >
        {Array.from({ length: CELLS }, (_, i) => (
          <span
            key={i}
            data-lit={lit.has(i) ? "true" : undefined}
            data-me={me === i ? "true" : undefined}
            className={cn(
              "block rounded-[1px]",
              me === i && view?.configured ? "bg-accent" : lit.has(i) ? "bg-grid-3" : "bg-grid-0",
            )}
          />
        ))}
      </div>
    </div>
  );
}
