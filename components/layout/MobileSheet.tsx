"use client";

import Link from "next/link";
import { Dialog } from "radix-ui";
import { navLinks, resumeHref, site } from "@/lib/site";
import { buttonClass } from "@/components/ui/Button";

/** Full-screen sheet menu for small screens. Lazy-loaded by MobileMenu on first open. */
export default function MobileSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Content className="fixed inset-0 z-[60] flex flex-col bg-bg focus:outline-none">
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
                onClick={() => onOpenChange(false)}
                className="flex items-baseline gap-4 rounded-sm px-2 py-3 text-2xl font-semibold text-text hover:bg-surface"
              >
                <span className="font-mono text-xs text-accent">0{i + 1}</span>
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-border p-4">
            <a href={resumeHref} className={buttonClass("outline", "md", "w-full")}>
              Download résumé
            </a>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
