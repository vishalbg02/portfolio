"use client";

import { Dialog } from "radix-ui";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils/cn";
import dynamic from "next/dynamic";
import { GridChat } from "./GridChat";
import { useRevealRef } from "@/lib/fx/use-reveal";
import { PULL_HANDLE_CLASS, usePullToClose } from "@/components/ui/usePullToClose";

const LiveChat = dynamic(() => import("@/components/live/LiveChat"), { ssr: false });

const MIN = 340;
const MAX = 720;
const DEFAULT = 420;
const KEY = "grid:layout";
/** Below this the page is too narrow to share with a docked panel; above it the dock button appears. */
const DOCK_MIN = 1100;

type Layout = { w: number; dock: boolean };
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function readLayout(): Layout {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Partial<Layout> | null;
    return { w: clamp(Number(raw?.w) || DEFAULT, MIN, MAX), dock: raw?.dock === true };
  } catch {
    return { w: DEFAULT, dock: false };
  }
}
function writeLayout(l: Layout) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(l));
  } catch {
    /* blocked: the size just is not remembered */
  }
}

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const iconBtn =
  "inline-flex size-8 items-center justify-center rounded-sm border border-border text-muted transition-colors " +
  "hover:border-border-2 hover:text-text pointer-coarse:size-11";

/**
 * GRID's chat as a panel. Desktop: a 420 px side sheet you can resize (drag the edge, or focus it and use the arrow
 * keys) and dock (the page makes room instead of being covered). It does not dim or lock the page, so GRID can
 * take you somewhere and you still see it. Phone: full screen, modal. Lazy-loaded by GridHost on first use.
 */
export default function GridSheet({
  open,
  onOpenChange,
  onClosed,
  view,
  onView,
  prefill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClosed: () => void;
  /** GRID's chat, or "Message Vishal" (the live chat). */
  view: "grid" | "live";
  onView: (v: "grid" | "live") => void;
  /** The start of a message handed to the live chat (a summary of what GRID was asked). */
  prefill?: string;
}) {
  const wide = useMedia("(min-width: 768px)");
  const canDock = useMedia(`(min-width: ${DOCK_MIN}px)`);
  const [layout, setLayout] = useState<Layout>(readLayout);
  const dragging = useRef(false);
  const docked = layout.dock && canDock && wide;

  const update = useCallback((next: Partial<Layout>) => {
    setLayout((l) => {
      const merged = { ...l, ...next };
      writeLayout(merged);
      return merged;
    });
  }, []);

  // The page knows the panel is there: the Omnibar steps aside, and a docked panel gets its room.
  useEffect(() => {
    const root = document.documentElement;
    if (!open) return;
    root.dataset.gridPanel = "open";
    root.style.setProperty("--grid-w", `${layout.w}px`);
    if (docked) root.dataset.gridDock = "open";
    return () => {
      delete root.dataset.gridPanel;
      delete root.dataset.gridDock;
      root.style.removeProperty("--grid-w");
    };
  }, [open, docked, layout.w]);

  const widthFromPointer = (clientX: number) =>
    clamp(window.innerWidth - clientX, MIN, Math.min(MAX, window.innerWidth - 320));

  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 64 : 16;
    const next =
      e.key === "ArrowLeft"
        ? layout.w + step
        : e.key === "ArrowRight"
          ? layout.w - step
          : e.key === "Home"
            ? MIN
            : e.key === "End"
              ? MAX
              : null;
    if (next === null) return;
    e.preventDefault();
    update({ w: clamp(next, MIN, MAX) });
  };

  const controls = (
    <>
      {canDock && wide ? (
        <button
          type="button"
          aria-pressed={layout.dock}
          aria-label={layout.dock ? "Float the panel over the page" : "Dock the panel beside the page"}
          title={layout.dock ? "Float over the page" : "Dock beside the page"}
          onClick={() => update({ dock: !layout.dock })}
          className={cn(iconBtn, layout.dock && "border-accent text-accent")}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="1.5" y="2" width="11" height="10" stroke="currentColor" strokeWidth="1.3" />
            <rect x="8" y="2" width="4.5" height="10" fill="currentColor" />
          </svg>
        </button>
      ) : null}
      <Dialog.Close aria-label="Close" className={iconBtn}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </Dialog.Close>
    </>
  );

  const revealRef = useRevealRef<HTMLDivElement>();

  // Phone: pull the sheet down by its handle to close it (the close button does the same for keyboards).
  const { handle, dy } = usePullToClose(() => onOpenChange(false));

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={!wide}>
      <Dialog.Portal>
        <Dialog.Content
          ref={revealRef}
          aria-describedby={undefined}
          data-grid-sheet=""
          data-docked={docked}
          style={{
            ["--grid-w" as string]: `${layout.w}px`,
            transform: dy ? `translateY(${dy}px)` : undefined,
          }}
          // Beside the page, not above it: clicking the page must not close the chat.
          onInteractOutside={(e) => {
            if (wide) e.preventDefault();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            onClosed();
          }}
          className={cn(
            "grid-sheet fixed inset-0 z-[71] flex flex-col bg-bg focus:outline-none",
            "md:inset-y-0 md:right-0 md:left-auto md:w-[var(--grid-w)] md:border-l md:border-border-2",
            // the phone's notch and home bar
            "max-md:pt-[env(safe-area-inset-top)] max-md:pb-[env(safe-area-inset-bottom)]",
          )}
        >
          <Dialog.Title className="sr-only">GRID, Vishal&apos;s AI</Dialog.Title>
          {wide ? null : (
            <div aria-hidden="true" data-grid-handle="" {...handle} className={PULL_HANDLE_CLASS}>
              {[0, 1, 2, 3, 4].map((k) => (
                <span key={k} className="size-1 rounded-[1px] bg-border-2" />
              ))}
            </div>
          )}
          {wide ? (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize the chat panel"
              aria-valuemin={MIN}
              aria-valuemax={MAX}
              aria-valuenow={layout.w}
              tabIndex={0}
              onKeyDown={onKey}
              onPointerDown={(e) => {
                dragging.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (dragging.current) update({ w: widthFromPointer(e.clientX) });
              }}
              onPointerUp={() => (dragging.current = false)}
              onPointerCancel={() => (dragging.current = false)}
              className="absolute inset-y-0 left-0 z-10 w-2 -translate-x-1/2 cursor-col-resize touch-none hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
            />
          ) : null}
          {view === "live" ? (
            <LiveChat onBack={() => onView("grid")} controls={controls} prefill={prefill} />
          ) : (
            <GridChat
              variant="sheet"
              autoFocus
              onJump={() => {
                if (!wide) onOpenChange(false);
              }}
              onLive={() => onView("live")}
              controls={controls}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
