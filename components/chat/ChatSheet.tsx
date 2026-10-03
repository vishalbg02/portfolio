"use client";

import { Dialog } from "radix-ui";
import { ChatPanel } from "./ChatPanel";

/** The sheet itself (Radix Dialog + the chat). Lazy-loaded by ChatLauncher on first use. */
export default function ChatSheet({
  open,
  onOpenChange,
  onClosed,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onClosed: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-bg/80" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            onClosed();
          }}
          className="fixed inset-x-3 top-[8vh] bottom-3 z-[71] mx-auto flex max-w-2xl flex-col overflow-hidden rounded-card border border-border bg-bg focus:outline-none sm:inset-x-6 sm:bottom-auto sm:h-[min(640px,84vh)]"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Dialog.Title className="font-mono text-xs tracking-[0.12em] text-muted uppercase">
              <span className="mr-2 text-accent">?</span>Ask Vishal
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
          <div className="min-h-0 flex-1">
            <ChatPanel variant="sheet" autoFocus />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
