"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

export const OPEN_CHAT_EVENT = "app:open-chat";

const loadSheet = () => import("./ChatSheet");
const ChatSheet = dynamic(loadSheet, { ssr: false });

/**
 * Floating "Ask Vishal" button on every page. It is only a button: the sheet (Radix Dialog + chat)
 * is a separate chunk fetched on first hover/focus/click. The button hides while the inline
 * section is on screen so the page never shows two entry points at once.
 */
export function ChatLauncher() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [inlineVisible, setInlineVisible] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  const show = () => {
    setMounted(true);
    setOpen(true);
  };

  useEffect(() => {
    const onOpen = () => {
      setMounted(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpen);
  }, []);

  useEffect(() => {
    const el = document.getElementById("ask");
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInlineVisible(Boolean(entry?.isIntersecting)), {
      threshold: 0.2,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      {!inlineVisible || open ? (
        <button
          ref={trigger}
          type="button"
          aria-haspopup="dialog"
          onPointerEnter={() => void loadSheet()}
          onFocus={() => void loadSheet()}
          onClick={show}
          className="fixed right-4 bottom-4 z-40 hidden h-11 items-center gap-2 rounded-pill border border-border-2 bg-surface px-4 font-mono text-sm text-text transition-colors hover:border-accent hover:text-accent md:inline-flex"
        >
          <span aria-hidden="true" className="text-accent">
            ?
          </span>
          Ask Vishal
        </button>
      ) : null}
      {mounted ? (
        <ChatSheet open={open} onOpenChange={setOpen} onClosed={() => trigger.current?.focus()} />
      ) : null}
    </>
  );
}
