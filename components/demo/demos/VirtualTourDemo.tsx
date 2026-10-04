"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Sketch } from "@/components/work/Sketch";
import { track } from "@/lib/analytics";

/**
 * The CHRIST Virtual Tour allows embedding, so this one is the real thing. Nothing is requested
 * from the tour's origin until the visitor clicks "Launch live demo": the frame starts as the
 * code-drawn sketch plus a button. The iframe is sandboxed (scripts, same-origin and pointer lock
 * only), sends no referrer, and its origin is the only entry in the CSP's frame-src.
 */
export function VirtualTourDemo({ src }: { src: string }) {
  const [launched, setLaunched] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const canFullscreen = useSyncExternalStore(
    () => () => {},
    () => document.fullscreenEnabled === true,
    () => false,
  );
  const frame = useRef<HTMLDivElement>(null);
  const host = new URL(src).host;

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frame.current?.requestFullscreen?.();
  };

  return (
    <figure data-demo="virtual-tour" className="my-8 rounded-card border border-border bg-surface p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs text-muted">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2 rounded-pill bg-id-virtual-tour" />
          Try it live
        </span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-link underline-offset-4 hover:underline"
        >
          Open in new tab ↗<span className="sr-only"> (opens in a new tab)</span>
        </a>
        {launched && canFullscreen ? (
          <button
            type="button"
            aria-pressed={fullscreen}
            onClick={toggleFullscreen}
            className="rounded-sm border border-border px-2.5 py-1 text-text transition-colors hover:border-border-2"
          >
            {fullscreen ? "Exit full screen" : "Full screen"}
          </button>
        ) : null}
      </div>

      <div ref={frame} className="overflow-hidden rounded-card border border-border-2 bg-bg">
        <div className="flex items-center gap-3 border-b border-border px-3 py-2">
          <span aria-hidden="true" className="flex gap-1.5">
            <i className="size-2.5 rounded-pill border border-border-2" />
            <i className="size-2.5 rounded-pill border border-border-2" />
            <i className="size-2.5 rounded-pill border border-border-2" />
          </span>
          <span className="min-w-0 flex-1 truncate rounded-pill border border-border bg-surface px-3 py-0.5 text-center font-mono text-[11px] text-muted">
            {host}
          </span>
        </div>
        <div className={fullscreen ? "h-[calc(100vh-42px)]" : "relative aspect-[16/10] min-h-[320px] w-full"}>
          {launched ? (
            <iframe
              src={src}
              title="CHRIST University Virtual Tour, live demo"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-pointer-lock"
              allow="fullscreen"
              referrerPolicy="no-referrer"
              className="absolute inset-0 size-full border-0"
            />
          ) : (
            <div className="stage-grid absolute inset-0 grid place-items-center p-4">
              <div className="w-full max-w-[420px] text-center">
                <Sketch slug="virtual-tour" />
                <button
                  type="button"
                  onClick={() => {
                    track("demo_launch", { project: "virtual-tour" });
                    setLaunched(true);
                  }}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-sm border border-accent px-4 font-mono text-sm text-accent transition-colors hover:bg-accent hover:text-bg"
                >
                  Launch live demo <span aria-hidden="true">▶</span>
                </button>
                <p className="mt-2 font-mono text-[11px] text-muted">
                  Loads the real tour from {host} only when you click.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </figure>
  );
}
