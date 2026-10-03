"use client";

import { Dialog } from "radix-ui";
import { shortcutList } from "@/lib/shortcuts";
import { Kbd } from "./Kbd";
import { useIsMac } from "./useIsMac";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (e: Event) => void;
};

/** `?` overlay listing keyboard shortcuts. Lazy-loaded. */
export default function HelpImpl({ open, onOpenChange, onCloseAutoFocus }: Props) {
  const isMac = useIsMac();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-bg/80" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={onCloseAutoFocus}
          className="fixed top-[16vh] left-1/2 z-[71] w-[min(420px,calc(100vw-24px))] -translate-x-1/2 rounded-card border border-border bg-surface p-5 focus:outline-none"
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
