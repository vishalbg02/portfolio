"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { START_TOUR_EVENT } from "@/lib/tour/events";

const Tour = dynamic(() => import("./Tour"), { ssr: false });

/**
 * Always mounted and tiny: it only listens. The tour (code, script, captions) is fetched the first time it starts, from the
 * hero link, `t`, the Omnibar, GRID, or `/?tour=1`. The tour plays on the home page; started anywhere else it takes you
 * there first.
 */
export function TourHost() {
  const [on, setOn] = useState(false);

  const start = useCallback(() => {
    if (window.location.pathname !== "/") {
      window.location.assign(new URL("/?tour=1", window.location.origin).href);
      return;
    }
    setOn((was) => {
      if (!was) track("tour_start");
      return true;
    });
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const el = (e.target as Element | null)?.closest("[data-tour-open]");
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      start();
    };
    window.addEventListener(START_TOUR_EVENT, start);
    document.addEventListener("click", onClick, true);
    // /?tour=1 (from another page, or a link someone shares): start once the page is up, then tidy the address
    const url = new URL(window.location.href);
    let t = 0;
    if (url.pathname === "/" && url.searchParams.get("tour") === "1") {
      url.searchParams.delete("tour");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      t = window.setTimeout(start, 600);
    }
    document.documentElement.dataset.tour = "ready";
    return () => {
      delete document.documentElement.dataset.tour;
      window.clearTimeout(t);
      window.removeEventListener(START_TOUR_EVENT, start);
      document.removeEventListener("click", onClick, true);
    };
  }, [start]);

  return on ? <Tour onExit={() => setOn(false)} /> : null;
}
