"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { setSound } from "@/lib/sound";
import { PresenceWall } from "./PresenceWall";
import { useAchievements } from "@/lib/use-achievements";
import { useSoundOn } from "@/lib/use-sound";
import { cn } from "@/lib/utils/cn";

const AchievementsDialog = dynamic(() => import("./AchievementsDialog"), { ssr: false });

const btn =
  "inline-flex min-h-8 items-center gap-2 rounded-sm border border-border px-2.5 font-mono text-xs text-muted transition-colors hover:border-border-2 hover:text-text pointer-coarse:min-h-11";

/**
 * The footer's playful corner: who is here right now (the visitor wall), how many hidden things you have found, and the
 * sound switch. Small and client-only; the dialog and the wall are separate lazy chunks.
 */
export function FooterExtras() {
  const { count, total } = useAchievements();
  const sound = useSoundOn();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <PresenceWall />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => {
            setMounted(true);
            setOpen(true);
          }}
          className={btn}
        >
          <span aria-hidden="true" className="text-accent">
            ◆
          </span>
          <span data-testid="ach-count">
            {count}/{total} discovered
          </span>
        </button>
        <button type="button" aria-pressed={sound} onClick={() => setSound(!sound)} className={btn}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 5h2.5L8 2.5v9L4.5 9H2z" fill="currentColor" />
            {sound ? (
              <path d="M10 4.5c1 1.4 1 3.6 0 5" stroke="currentColor" strokeWidth="1.3" />
            ) : (
              <path d="M10 5l3 4M13 5l-3 4" stroke="currentColor" strokeWidth="1.3" />
            )}
          </svg>
          <span className={cn(sound && "text-text")}>Sound {sound ? "on" : "off"}</span>
        </button>
      </div>
      {mounted ? <AchievementsDialog open={open} onOpenChange={setOpen} /> : null}
    </div>
  );
}
