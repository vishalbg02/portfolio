"use client";

import { usePresence } from "@/lib/live/use-presence";
import { PresenceChip } from "./PresenceChip";

/**
 * The Contact section's first action: message Vishal live. The button is a plain `data-live-open` element that GridHost
 * answers, so this island only fetches the presence chip after the page is up. Space for the chip is reserved, so
 * nothing moves when it arrives.
 */
export function LiveContactButton() {
  const presence = usePresence();
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <button
        type="button"
        data-live-open=""
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-sm border border-accent bg-accent px-4 font-medium text-bg transition-[filter] hover:brightness-110"
      >
        Message Vishal
        <span aria-hidden="true">→</span>
      </button>
      <p className="mt-2.5 min-h-4 text-center">
        {presence?.configured ? (
          <PresenceChip presence={presence} />
        ) : (
          <span className="font-mono text-[11px] text-muted">
            Leave a message: it goes to his phone and inbox.
          </span>
        )}
      </p>
    </div>
  );
}
