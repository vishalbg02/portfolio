"use client";

import { openGrid, openLive } from "@/lib/grid/events";
import { RecruiterToggle } from "./RecruiterToggle";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { navLinks, resumeHref, site } from "@/lib/site";
import { buttonClass } from "@/components/ui/Button";
import { PULL_HANDLE_CLASS, usePullToClose } from "@/components/ui/usePullToClose";

/** Full-screen sheet menu for small screens. Lazy-loaded by MobileMenu on first open. */
export default function MobileSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { handle, dy } = usePullToClose(() => onOpenChange(false));
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Content
          style={dy ? { transform: `translateY(${dy}px)` } : undefined}
          className="mobile-sheet fixed inset-0 z-[60] flex flex-col bg-bg pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] focus:outline-none"
        >
          <div aria-hidden="true" data-sheet-handle="" {...handle} className={PULL_HANDLE_CLASS}>
            {[0, 1, 2, 3, 4].map((k) => (
              <span key={k} className="size-1 rounded-[1px] bg-border-2" />
            ))}
          </div>
          <div className="flex h-(--nav-height) items-center justify-between border-b border-border px-4">
            <Dialog.Title className="font-mono text-sm text-text">{site.wordmark}</Dialog.Title>
            <Dialog.Close
              className="inline-flex size-10 items-center justify-center rounded-sm border border-border text-text hover:border-border-2"
              aria-label="Close menu"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none">
                <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Site navigation</Dialog.Description>
          <nav aria-label="Mobile" className="flex flex-1 flex-col gap-1 px-4 py-6">
            {navLinks.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={link.href.startsWith("/#") ? false : undefined}
                onClick={() => onOpenChange(false)}
                className="flex items-baseline gap-4 rounded-sm px-2 py-3 text-2xl font-semibold text-text hover:bg-surface active:bg-surface-2"
              >
                <span className="font-mono text-xs text-accent">0{i + 1}</span>
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                window.setTimeout(() => openGrid(), 150);
              }}
              className="flex items-baseline gap-4 rounded-sm px-2 py-3 text-left text-2xl font-semibold text-text hover:bg-surface active:bg-surface-2"
            >
              <span aria-hidden="true" className="font-mono text-xs text-accent">
                ?
              </span>
              Ask GRID
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                window.setTimeout(() => openLive(), 150);
              }}
              className="flex items-baseline gap-4 rounded-sm px-2 py-3 text-left text-2xl font-semibold text-text hover:bg-surface active:bg-surface-2"
            >
              <span aria-hidden="true" className="font-mono text-xs text-accent">
                @
              </span>
              Message Vishal
            </button>
            <RecruiterToggle
              onNavigate={() => onOpenChange(false)}
              className="flex items-baseline gap-4 rounded-sm px-2 py-3 text-2xl font-semibold text-text hover:bg-surface active:bg-surface-2"
            />
          </nav>
          <div className="border-t border-border p-4">
            <a
              href={resumeHref}
              target="_blank"
              rel="noopener"
              className={buttonClass("outline", "md", "w-full")}
              data-track="resume_download"
            >
              Download résumé
            </a>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
