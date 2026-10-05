"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { StatusBadge } from "@/components/work/StatusBadge";
import { track } from "@/lib/analytics";
import { embedFor } from "@/lib/security/embeds";
import { useStatuses } from "@/lib/status/store";

/**
 * A project's real, running site, the same way for every project:
 * - the site allows framing (`/api/status` reads its headers: `embeddable`) and its origin is in lib/security/embeds.ts:
 *   "Launch live site" loads it in a sandboxed frame, only after the click, with full screen and "Open in new tab";
 * - it does not (Golden Verdict today): its real captures (`children`) and a prominent "Visit live site" link;
 * - it is down: the captures and an "offline right now" note. Never a frame the browser would refuse.
 */
export function LiveSite({
  slug,
  src,
  name,
  children,
}: {
  slug: string;
  src: string;
  name: string;
  children: ReactNode;
}) {
  const { phase, statuses } = useStatuses();
  const status = statuses[slug];
  const embed = embedFor(src);
  const canEmbed = embed !== null && status?.embeddable === true && status.state !== "offline";
  const offline = phase === "ready" && status?.state === "offline";
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
    <figure
      data-live={slug}
      data-live-site={canEmbed ? "embeddable" : offline ? "offline" : "captures"}
      className="my-8 rounded-card border border-border bg-surface p-3 sm:p-4"
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs text-muted">
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2 rounded-pill"
            style={{ background: `var(--id-${slug})` }}
          />
          {canEmbed ? "Try it live" : "The live site"}
        </span>
        <StatusBadge slug={slug} />
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-link underline-offset-4 hover:underline"
          data-track="project_live_click"
          data-track-project={slug}
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
          {launched && embed ? (
            <iframe
              src={src}
              title={`${name}, the live site`}
              loading="lazy"
              sandbox={embed.sandbox}
              allow="fullscreen"
              referrerPolicy="no-referrer"
              className="absolute inset-0 size-full border-0"
            />
          ) : (
            <>
              <div className="absolute inset-0">{children}</div>
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-3 border-t border-border bg-bg p-3">
                {canEmbed ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        track("demo_launch", { project: slug });
                        setLaunched(true);
                      }}
                      className="inline-flex h-10 items-center gap-2 rounded-sm border border-accent px-4 font-mono text-sm text-accent transition-colors hover:bg-accent hover:text-bg"
                    >
                      Launch live site <span aria-hidden="true">▶</span>
                    </button>
                    <p className="font-mono text-[11px] text-muted">Loads {host} only when you click.</p>
                  </>
                ) : (
                  <>
                    <a
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-track="project_live_click"
                      data-track-project={slug}
                      className="inline-flex h-10 items-center gap-2 rounded-sm bg-accent px-4 font-mono text-sm font-semibold text-bg"
                    >
                      Visit live site <span aria-hidden="true">↗</span>
                      <span className="sr-only"> ({name}, opens in a new tab)</span>
                    </a>
                    <p className="font-mono text-[11px] text-muted">
                      {offline
                        ? "Offline right now: these are real captures."
                        : "Real captures of the public site."}
                    </p>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </figure>
  );
}
