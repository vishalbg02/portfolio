"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { RailSection } from "./GridRail";

const GridRail = dynamic(() => import("./GridRail"), { ssr: false });

/** Mounts the rail after the browser is idle, so it never competes with the hero for LCP. */
export function RailLoader({ sections }: { sections: RailSection[] }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number })
      .requestIdleCallback;
    const id = idle ? idle(() => setReady(true)) : window.setTimeout(() => setReady(true), 400);
    return () => {
      if (!idle) window.clearTimeout(id);
    };
  }, []);
  return ready ? <GridRail sections={sections} /> : null;
}
