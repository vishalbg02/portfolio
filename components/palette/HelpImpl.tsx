"use client";

import { Dialog } from "radix-ui";
import { useState, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";
import { haptic } from "@/lib/haptics";
import { disableShake, enableShake, shakeEnabled, shakeSupported } from "@/lib/shake-host";
import { openCosmoStrike } from "@/lib/delight";
import { shortcutList } from "@/lib/shortcuts";
import { commandHelp } from "@/lib/terminal/commands";
import { Kbd } from "./Kbd";
import { useIsMac } from "./useIsMac";
import { useRevealRef } from "@/lib/fx/use-reveal";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (e: Event) => void;
};

/**
 * The shake easter egg's switch. iOS only shows its motion-permission prompt in response to a tap, so
 * this explicit button is the only place that ever asks (never on load). Phones and tablets only.
 */
function ShakeToggle() {
  const [on, setOn] = useState(shakeEnabled());
  const [note, setNote] = useState<string | null>(null);
  const touch = useSyncExternalStore(
    () => () => {},
    () => shakeSupported() && window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );
  if (!touch) return null;
  return (
    <div className="mt-4 border-t border-border pt-4">
      <button
        type="button"
        aria-pressed={on}
        onClick={async () => {
          if (on) {
            disableShake();
            setOn(false);
            setNote(null);
            return;
          }
          const ok = await enableShake(() => {
            haptic(30);
            track("easter_egg_found", { name: "shake" });
            openCosmoStrike();
          });
          setOn(ok);
          setNote(
            ok ? "Shake your phone to play CosmoStrike." : "Motion access wasn't granted, so shake is off.",
          );
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-border-2 px-3 font-mono text-xs text-text transition-colors hover:border-accent"
      >
        <span aria-hidden="true" className="text-accent">
          {on ? "●" : "○"}
        </span>
        {on ? "Shake easter egg is on" : "Enable shake easter egg"}
      </button>
      {note ? (
        <p role="status" className="mt-2 font-mono text-[11px] text-muted">
          {note}
        </p>
      ) : null}
    </div>
  );
}

/** `?` overlay listing keyboard shortcuts, terminal commands and the phone dock. Lazy-loaded. */
export default function HelpImpl({ open, onOpenChange, onCloseAutoFocus }: Props) {
  const isMac = useIsMac();
  const revealRef = useRevealRef<HTMLDivElement>();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-bg/80" />
        <Dialog.Content
          ref={revealRef}
          aria-describedby={undefined}
          onCloseAutoFocus={onCloseAutoFocus}
          className="fixed top-[8vh] left-1/2 z-[71] max-h-[84vh] w-[min(460px,calc(100vw-24px))] -translate-x-1/2 overflow-y-auto rounded-card border border-border bg-surface p-5 focus:outline-none"
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-mono text-xs tracking-[0.12em] text-muted uppercase">
              <span className="mr-2 text-accent">?</span>Keyboard shortcuts
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
          <ul className="mt-4 divide-y divide-border">
            {shortcutList.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span className="text-text">{s.label}</span>
                <span className="flex items-center gap-1">
                  {s.keys.map((k) => (
                    <Kbd key={k}>{k === "mod" ? (isMac ? "⌘" : "Ctrl") : k}</Kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>

          <h3 className="mt-5 font-mono text-[11px] tracking-[0.12em] text-muted uppercase">
            Terminal commands <span className="normal-case">(hero prompt or ~)</span>
          </h3>
          <ul
            tabIndex={0}
            aria-label="Terminal commands"
            className="mt-2 max-h-[22vh] divide-y divide-border overflow-y-auto font-mono text-xs"
          >
            {commandHelp().map((c) => (
              <li key={c.usage} className="flex items-baseline justify-between gap-4 py-1.5">
                <code className="shrink-0 text-text">{c.usage}</code>
                <span className="text-right text-muted">{c.summary}</span>
              </li>
            ))}
          </ul>

          <h3 className="mt-5 font-mono text-[11px] tracking-[0.12em] text-muted uppercase">On a phone</h3>
          <p className="mt-2 text-sm text-muted">
            The bottom dock has <span className="text-text">Work · Ask · Résumé · Contact</span>. It hides as
            you scroll down and returns when you scroll up.
          </p>
          <ShakeToggle />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
