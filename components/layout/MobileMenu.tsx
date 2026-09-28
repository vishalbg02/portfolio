"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";

const loadSheet = () => import("./MobileSheet");
const MobileSheet = dynamic(loadSheet, { ssr: false });

/**
 * Menu trigger. The Radix dialog sheet is code-split and only fetched on first
 * hover/focus/tap, keeping it out of the initial bundle.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const preload = () => void loadSheet();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerEnter={preload}
        onFocus={preload}
        onClick={() => {
          setRequested(true);
          setOpen(true);
        }}
        className="inline-flex size-10 items-center justify-center rounded-sm border border-border text-text hover:border-border-2 md:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none">
          <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      {requested ? <MobileSheet open={open} onOpenChange={handleOpenChange} /> : null}
    </>
  );
}
