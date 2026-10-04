"use client";

import { Dialog } from "radix-ui";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { useRevealRef } from "@/lib/fx/use-reveal";
import { useAchievements } from "@/lib/use-achievements";

/** The explorer list: what has been found in this browser, and a hint for what hasn't. Lazy-loaded. */
export default function AchievementsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { found, count, total } = useAchievements();
  const revealRef = useRevealRef<HTMLDivElement>();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-bg/80" />
        <Dialog.Content
          ref={revealRef}
          aria-describedby="ach-note"
          className="fixed top-[8vh] left-1/2 z-[71] max-h-[84vh] w-[min(460px,calc(100vw-24px))] -translate-x-1/2 overflow-y-auto rounded-card border border-border bg-surface p-5 focus:outline-none"
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-mono text-xs tracking-[0.12em] text-muted uppercase">
              <span className="mr-2 text-accent">◆</span>Explorer · {count}/{total} discovered
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="inline-flex size-8 items-center justify-center rounded-sm border border-border text-muted hover:border-border-2 hover:text-text"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </Dialog.Close>
          </div>
          <p id="ach-note" className="mt-2 text-sm text-muted">
            Things hidden around this site. What you find is remembered in this browser only.
          </p>
          <ul className="mt-4 divide-y divide-border">
            {ACHIEVEMENTS.map((a) => {
              const got = found.includes(a.id);
              return (
                <li key={a.id} data-found={got} className="flex items-start gap-3 py-3">
                  <span
                    aria-hidden="true"
                    className={`mt-1 size-3 shrink-0 rounded-[2px] ${got ? "bg-accent" : "border border-border-2"}`}
                  />
                  <div className="min-w-0 text-sm">
                    <p className={got ? "text-text" : "text-muted"}>
                      {got ? a.label : "Not found yet"}
                      <span className="sr-only">{got ? ": found" : ""}</span>
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted">
                      {got ? "Found" : `Hint: ${a.hint}`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
