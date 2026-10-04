"use client";

import { Kbd } from "@/components/palette/Kbd";
import { useIsMac } from "@/components/palette/useIsMac";
import { openOmnibar } from "@/lib/grid/events";
import { preloadOmnibar } from "@/lib/shortcuts";

/** Nav pill advertising ⌘K: opens the Omnibar (commands and GRID). Desktop only; hidden below md. */
export function PaletteButton() {
  const isMac = useIsMac();
  return (
    <button
      type="button"
      onClick={() => openOmnibar()}
      onPointerEnter={preloadOmnibar}
      onFocus={preloadOmnibar}
      aria-keyshortcuts="Control+K Meta+K"
      className="hidden h-8 items-center gap-2 rounded-pill border border-border pr-1.5 pl-3 font-mono text-xs text-muted transition-colors hover:border-border-2 hover:text-text md:inline-flex"
    >
      Search
      <span className="flex gap-1">
        <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  );
}
