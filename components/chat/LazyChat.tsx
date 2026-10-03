"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const ChatPanel = dynamic(() => import("./ChatPanel").then((m) => m.ChatPanel), { ssr: false });

/**
 * Mounts the chat panel only when its section is about to scroll into view, so none of the chat
 * code counts toward the initial bundle. The placeholder has the panel's height (no layout shift).
 */
export function LazyChat() {
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
    <div ref={ref} className="min-h-[360px]">
      {visible ? (
        <ChatPanel />
      ) : (
        <div
          className="rounded-card border border-border bg-surface px-4 py-6 font-mono text-sm text-muted"
          role="status"
        >
          Loading the assistant…
        </div>
      )}
    </div>
  );
}
