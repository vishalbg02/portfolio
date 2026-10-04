"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const GridChat = dynamic(() => import("./GridChat").then((m) => m.GridChat), { ssr: false });

/**
 * The inline chat in the Ask section. It mounts only when the section is about to scroll into view, so none of the
 * chat code counts toward the initial bundle; the placeholder has the chat's height (no layout shift).
 */
export function LazyGridChat() {
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
    <div ref={ref} className="min-h-[420px]">
      {visible ? (
        <GridChat variant="inline" />
      ) : (
        <div
          className="rounded-card border border-border bg-surface px-4 py-6 font-mono text-sm text-muted"
          role="status"
        >
          Loading GRID…
        </div>
      )}
    </div>
  );
}
