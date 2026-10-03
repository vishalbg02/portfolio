"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const SnakeGame = dynamic(() => import("./SnakeGame"), {
  ssr: false,
  loading: () => <p className="font-mono text-sm text-muted">loading…</p>,
});

/** The 404 page stays light: the game's code is only fetched after the visitor asks for it. */
export function LazySnake() {
  const [show, setShow] = useState(false);
  if (show) return <SnakeGame />;
  return (
    <button
      type="button"
      onClick={() => setShow(true)}
      className="h-11 rounded-sm border border-border px-5 font-medium text-text transition-colors hover:border-border-2 hover:bg-surface-2"
    >
      Play snake while you&apos;re here
    </button>
  );
}
