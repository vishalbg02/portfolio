"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { GridFace } from "./GridFace";

/**
 * What holds the chat's place before and while it loads. It is the same height as the opened chat, so when the chat
 * arrives, nothing below it moves. The loading fallback matters as much as the one before it: between "near" and
 * "chunk arrived" a dynamic import renders nothing, and the column would collapse to the other column's height.
 */
function ChatSkeleton() {
  return (
    <div
      role="status"
      className="flex h-[670px] flex-col rounded-card border border-border bg-surface sm:h-[628px] pointer-coarse:h-[715px] sm:pointer-coarse:h-[661px]"
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
  );
}

const GridChat = dynamic(() => import("./GridChat").then((m) => m.GridChat), {
  ssr: false,
  loading: () => <ChatSkeleton />,
});
const MeetGridLive = dynamic(() => import("./stage/MeetGridLive").then((m) => m.MeetGridLive), {
  ssr: false,
});

/**
 * The inline chat in the Meet GRID section. It mounts only when the section is about to scroll into view, so none of
 * the chat code counts toward the initial bundle, and brings the section's live layer with it (the face that looks
 * at you, the pipeline strip). The placeholder is as tall as the chat is when it opens (its log has a fixed height,
 * so that is the same at every width up to a line of wrapping in the header), so nothing below it moves.
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
    <div ref={ref}>
      {visible ? (
        <>
          <GridChat variant="inline" />
          <MeetGridLive />
        </>
      ) : (
        <ChatSkeleton />
      )}
    </div>
  );
}
