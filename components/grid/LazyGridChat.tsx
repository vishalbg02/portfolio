"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { DemoScene } from "@/lib/grid/demo";
import { GridFace } from "./GridFace";

const GridChat = dynamic(() => import("./GridChat").then((m) => m.GridChat), { ssr: false });

/**
 * The inline chat in the Ask section. It mounts only when the section is about to scroll into view, so none of the
 * chat code counts toward the initial bundle. The placeholder is as tall as the chat is when it opens (its demo has a fixed
 * height, so that is the same at every width up to a line or two of wrapping), so nothing below it moves.
 */
export function LazyGridChat({ scenes }: { scenes: DemoScene[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      const t = window.setTimeout(() => setVisible(true), 0); // very old browsers: just load it
      return () => window.clearTimeout(t);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div ref={ref}>
      {visible ? (
        <GridChat variant="inline" demo={scenes} />
      ) : (
        <div
          role="status"
          className="flex h-[1136px] flex-col rounded-card border border-border bg-surface min-[560px]:h-[1096px] sm:h-[952px]"
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <GridFace state="thinking" size={36} />
            <div>
              <p className="font-mono text-sm text-text">GRID</p>
              <p className="font-mono text-[11px] text-muted">Loading GRID…</p>
            </div>
          </div>
          <noscript>
            <p className="p-4 text-sm text-muted">
              GRID needs JavaScript. The rest of this site works without it.
            </p>
          </noscript>
          <div className="flex-1" />
        </div>
      )}
    </div>
  );
}
