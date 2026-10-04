"use client";

import { Dialog } from "radix-ui";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { ViewerItem } from "./viewer-types";

/**
 * Full-screen viewer for a project's real captures: arrows, swipe, ←/→ and Esc, one caption per image
 * (the alt text is shown, so nothing is only for screen readers). Lazy: it is fetched on the first open.
 */
export function MediaViewer({
  name,
  items,
  start,
  onClose,
}: {
  name: string;
  items: ViewerItem[];
  start: number;
  onClose: () => void;
}) {
  const [i, setI] = useState(Math.min(start, items.length - 1));
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const item = items[i]!;
  const go = (d: number) => setI((n) => (n + d + items.length) % items.length);

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-bg" />
        <Dialog.Content
          aria-describedby={undefined}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(1);
            else if (e.key === "ArrowLeft") go(-1);
          }}
          className="fixed inset-0 z-[81] flex flex-col focus:outline-none"
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Dialog.Title className="min-w-0 flex-1 truncate font-mono text-xs tracking-[0.12em] text-muted uppercase">
              {name}
              {item.caption ? <span className="text-text"> · {item.caption}</span> : null}
            </Dialog.Title>
            <span className="font-mono text-xs text-muted" aria-live="polite">
              {i + 1} / {items.length}
            </span>
            <Dialog.Close
              aria-label="Close full screen"
              className="inline-flex size-11 items-center justify-center rounded-sm border border-border text-muted hover:border-border-2 hover:text-text"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </Dialog.Close>
          </div>

          <div
            className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center p-3 sm:p-6"
            onPointerDown={(e) => {
              swipe.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerUp={(e) => {
              const s = swipe.current;
              swipe.current = null;
              if (!s) return;
              const dx = e.clientX - s.x;
              if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) go(dx < 0 ? 1 : -1);
            }}
          >
            <picture key={item.id} className="flex max-h-full max-w-full items-center justify-center">
              <source type="image/avif" srcSet={item.avifSet} />
              <source type="image/webp" srcSet={item.webpSet} />
              {/* eslint-disable-next-line @next/next/no-img-element -- the pre-encoded capture, shown as it was captured */}
              <img
                src={item.src}
                alt={item.alt}
                width={item.width}
                height={item.height}
                draggable={false}
                className={cn(
                  "block h-auto max-h-[calc(100dvh-220px)] w-auto max-w-full rounded-card border border-border-2 object-contain select-none",
                  item.frame === "phone" ? "max-w-[min(100%,360px)]" : "",
                )}
              />
            </picture>
            {items.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Previous screen"
                  onClick={() => go(-1)}
                  className="absolute top-1/2 left-2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-sm border border-border bg-bg font-mono text-text hover:border-accent hover:text-accent sm:left-4"
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label="Next screen"
                  onClick={() => go(1)}
                  className="absolute top-1/2 right-2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-sm border border-border bg-bg font-mono text-text hover:border-accent hover:text-accent sm:right-4"
                >
                  →
                </button>
              </>
            ) : null}
          </div>

          <div className="border-t border-border px-4 py-3">
            <p className="mx-auto max-w-3xl text-center text-sm text-muted">{item.alt}</p>
            {items.length > 1 ? (
              <div className="mt-2 flex items-center justify-center gap-1">
                {items.map((it, n) => (
                  <button
                    key={it.id}
                    type="button"
                    aria-label={`Show screen ${n + 1}`}
                    aria-current={n === i ? "true" : undefined}
                    onClick={() => setI(n)}
                    className="flex size-11 items-center justify-center"
                  >
                    <span
                      aria-hidden="true"
                      data-l={n === i ? "4" : "1"}
                      className="rail-sq block size-2.5 rounded-[2px]"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
