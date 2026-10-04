"use client";

import type { ReactNode } from "react";

/** Clicking empty terminal space focuses the prompt (links, summaries and text selection are left alone). */
export function FocusOnClick({ targetId, children }: { targetId: string; children: ReactNode }) {
  return (
    <div
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest("a, button, summary, input, details")) return;
        if (window.getSelection()?.toString()) return;
        document.getElementById(targetId)?.focus();
      }}
    >
      {children}
    </div>
  );
}
