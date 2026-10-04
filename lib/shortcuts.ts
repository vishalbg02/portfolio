import { shipped } from "@/lib/site";

export const OPEN_HELP_EVENT = "app:open-help";

/** Fetches the Omnibar panel early (hover/focus/first interaction) so ⌘K feels instant. */
export const preloadOmnibar = () => void import("@/components/grid/OmnibarPanel");

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

export type ShortcutHelp = { keys: string[]; label: string };

/** Listed in the `?` overlay. `mod` renders as ⌘ on macOS and Ctrl elsewhere. */
export const shortcutList: ShortcutHelp[] = [
  { keys: ["mod", "K"], label: "Ask GRID or run a command" },
  { keys: ["/"], label: "Ask GRID or run a command" },
  { keys: [">"], label: "In the Omnibar: commands only" },
  { keys: ["?"], label: "Show keyboard shortcuts" },
  { keys: ["j"], label: "Next section" },
  { keys: ["k"], label: "Previous section" },
  {
    keys: ["g", "w"],
    label: "Go to Work (g e Experience, g a Activity, g s Stack, g g GRID, g c Contact, g h top)",
  },
  ...(shipped.tour ? [{ keys: ["t"], label: "Take the 60-second tour" }] : []),
  ...(shipped.terminal ? [{ keys: ["~"], label: "Open terminal" }] : []),
  { keys: ["Esc"], label: "Close any overlay" },
];
