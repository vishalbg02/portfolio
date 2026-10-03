"use client";

import { Kbd } from "@/components/palette/Kbd";
import { useIsMac } from "@/components/palette/useIsMac";
import { openPalette, preloadPalette } from "@/lib/shortcuts";

/** Nav pill advertising ⌘K. Desktop only (needs a keyboard); hidden below md. */
export function PaletteButton() {
  const isMac = useIsMac();
  return (
    <button
      type="button"
      onClick={openPalette}
      onPointerEnter={preloadPalette}
      onFocus={preloadPalette}
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
