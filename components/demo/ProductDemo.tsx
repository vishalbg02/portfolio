"use client";

import { useEffect, useReducer, useRef, type KeyboardEvent, type ReactNode } from "react";
import { identityBg } from "@/components/work/identity";
import { track } from "@/lib/analytics";
import type { ProjectSlug } from "@/lib/content/profile-schema";
import { demoReducer, initialDemo } from "@/lib/demo/reducer";
import { cn } from "@/lib/utils/cn";

export type DemoStep = { id: string; label: string; caption: string };
export type DemoRole = { id: string; label: string };
export type DemoCtx = { step: number; stepId: string; role: number; roleId: string | null };

const STEP_MS = 1900;

/**
 * One API for every case-study demo: a labelled frame (browser or phone), numbered steps, an optional
 * role switcher, and a stage the demo draws. Keyboard: ←/→ move between steps, Enter/Space on a step or
 * role button picks it. It walks through the steps once, by itself, when it is 60 % on screen (never
 * under reduced motion), and any input from the visitor stops that.
 */
export function ProductDemo({
  slug,
  frame,
  url,
  steps,
  roles = [],
  link,
  children,
}: {
  slug: ProjectSlug;
  frame: "browser" | "phone";
  /** Shown in the browser bar / phone header. */
  url: string;
  steps: DemoStep[];
  roles?: DemoRole[];
  /** e.g. "Visit live site ↗" */
  link?: { href: string; label: string };
  children: (ctx: DemoCtx) => ReactNode;
}) {
  const dims = { steps: steps.length, roles: roles.length };
  const [state, dispatch] = useReducer(
    (s: typeof initialDemo, a: Parameters<typeof demoReducer>[1]) => demoReducer(s, a, dims),
    initialDemo,
  );
  const root = useRef<HTMLDivElement>(null);
  const humanStep = useRef(false);
  const ctx: DemoCtx = {
    step: state.step,
    stepId: steps[state.step]!.id,
    role: state.role,
    roleId: roles[state.role]?.id ?? null,
  };

  // Walk through once when 60 % visible.
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        dispatch({ type: "autoStart" });
        io.disconnect();
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (state.auto !== "playing") return;
    const t = window.setInterval(() => dispatch({ type: "autoTick" }), STEP_MS);
    return () => window.clearInterval(t);
  }, [state.auto]);

  // Count only steps the visitor chose, never the automatic walk-through.
  useEffect(() => {
    if (!humanStep.current) return;
    humanStep.current = false;
    track("demo_step", { project: slug, step: steps[state.step]!.id });
  }, [state.step, slug, steps]);

  const go = (step: number) => {
    humanStep.current = true;
    dispatch({ type: "goto", step });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" && state.step < steps.length - 1) {
      e.preventDefault();
      humanStep.current = true;
      dispatch({ type: "next" });
    } else if (e.key === "ArrowLeft" && state.step > 0) {
      e.preventDefault();
      humanStep.current = true;
      dispatch({ type: "prev" });
    }
  };

  const step = steps[state.step]!;
  const last = state.step === steps.length - 1;

  return (
    <figure
      ref={root}
      data-demo={slug}
      data-auto={state.auto}
      role="group"
      aria-label={`${url} interactive illustration`}
      onKeyDown={onKey}
      className="my-8 rounded-card border border-border bg-surface p-3 sm:p-4"
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-2 font-mono text-xs text-muted">
          <span aria-hidden="true" className={cn("size-2 rounded-pill", identityBg[slug])} />
          Interactive illustration — not the real product UI
        </span>
        {link ? (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto font-mono text-xs text-link underline-offset-4 hover:underline"
          >
            {link.label}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : null}
      </div>

      {roles.length > 0 ? (
        <div role="group" aria-label="View as" className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-xs text-muted">View as</span>
          {roles.map((r, i) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={i === state.role}
              onClick={() => {
                humanStep.current = false;
                dispatch({ type: "role", role: i });
              }}
              className={cn(
                "min-h-8 rounded-pill border px-3 font-mono text-xs transition-colors pointer-coarse:min-h-11",
                i === state.role
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted hover:border-border-2 hover:text-text",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* The frame reserves its height so stepping never shifts the page. */}
      <div
        className={cn(
          "mx-auto overflow-hidden border border-border-2 bg-bg",
          frame === "browser" ? "rounded-card" : "max-w-[320px] rounded-[28px] border-2",
        )}
      >
        {frame === "browser" ? (
          <div className="flex items-center gap-3 border-b border-border px-3 py-2">
            <span aria-hidden="true" className="flex gap-1.5">
              <i className="size-2.5 rounded-pill border border-border-2" />
              <i className="size-2.5 rounded-pill border border-border-2" />
              <i className="size-2.5 rounded-pill border border-border-2" />
            </span>
            <span className="min-w-0 flex-1 truncate rounded-pill border border-border bg-surface px-3 py-0.5 text-center font-mono text-[11px] text-muted">
              {url}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center border-b border-border py-2">
            <span aria-hidden="true" className="h-1 w-14 rounded-pill bg-border-2" />
          </div>
        )}
        <div
          className={cn("relative", frame === "browser" ? "h-[360px] sm:h-[340px]" : "h-[400px]")}
          aria-hidden="true"
        >
          {children(ctx)}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ol className="flex flex-wrap gap-1.5" aria-label="Steps">
          {steps.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                aria-current={i === state.step ? "step" : undefined}
                onClick={() => go(i)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-2 rounded-sm border px-3 font-mono text-xs transition-colors pointer-coarse:min-h-11",
                  i === state.step
                    ? "border-accent text-accent"
                    : "border-border text-muted hover:border-border-2 hover:text-text",
                )}
              >
                <span aria-hidden="true">{i + 1}</span>
                {s.label}
              </button>
            </li>
          ))}
        </ol>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Previous step"
            disabled={state.step === 0}
            onClick={() => {
              humanStep.current = true;
              dispatch({ type: "prev" });
            }}
            className="grid size-9 place-items-center rounded-sm border border-border font-mono text-sm text-text transition-colors hover:border-border-2 disabled:pointer-events-none disabled:opacity-40 pointer-coarse:size-11"
          >
            ←
          </button>
          {last ? (
            <button
              type="button"
              onClick={() => {
                humanStep.current = true;
                dispatch({ type: "replay" });
              }}
              className="inline-flex h-9 items-center rounded-sm border border-accent px-3 font-mono text-xs text-accent transition-colors hover:bg-accent hover:text-bg pointer-coarse:h-11"
            >
              Replay
            </button>
          ) : (
            <button
              type="button"
              aria-label="Next step"
              onClick={() => {
                humanStep.current = true;
                dispatch({ type: "next" });
              }}
              className="grid size-9 place-items-center rounded-sm border border-border font-mono text-sm text-text transition-colors hover:border-border-2 pointer-coarse:size-11"
            >
              →
            </button>
          )}
        </div>
      </div>

      <figcaption className="mt-3 min-h-12 text-sm text-muted" aria-live="polite">
        <span className="font-mono text-xs text-text">
          Step {state.step + 1} of {steps.length} · {step.label}.
        </span>{" "}
        {step.caption}
      </figcaption>
    </figure>
  );
}

/** Tiny shared bits the demo stages are drawn from. */
export const Bar = ({ w = "100%", accent = false }: { w?: string; accent?: boolean }) => (
  <i
    className={cn("block h-1.5 rounded-pill", accent ? "bg-[var(--c)]" : "bg-surface-2")}
    style={{ width: w }}
  />
);
