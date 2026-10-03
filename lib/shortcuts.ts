import { shipped } from "@/lib/site";

export const OPEN_PALETTE_EVENT = "app:open-palette";
export const OPEN_HELP_EVENT = "app:open-help";

export const openPalette = () => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));

/** Fetches the palette chunk early (hover/focus/first interaction) so ⌘K feels instant. */
export const preloadPalette = () => void import("@/components/palette/PaletteImpl");

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

export type ShortcutHelp = { keys: string[]; label: string };

/** Listed in the `?` overlay. `mod` renders as ⌘ on macOS and Ctrl elsewhere. */
export const shortcutList: ShortcutHelp[] = [
  { keys: ["mod", "K"], label: "Open command palette" },
  { keys: ["/"], label: "Search (command palette)" },
  { keys: ["?"], label: "Show keyboard shortcuts" },
  ...(shipped.terminal ? [{ keys: ["~"], label: "Open terminal" }] : []),
  { keys: ["Esc"], label: "Close any overlay" },
];
