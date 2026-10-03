"use client";

import dynamic from "next/dynamic";

/**
 * The 404 board is visible straight away (paused, "press any key or tap to start"). Its code is a
 * separate chunk; the placeholder has the final size so nothing shifts when it loads.
 */
export const LazySnake = dynamic(() => import("./SnakeGame"), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden="true"
      className="aspect-square w-full max-w-[360px] rounded-card border border-border bg-surface"
    />
  ),
});
