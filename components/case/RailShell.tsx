"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The sticky right rail of a case study. The architecture diagram breaks out to the full width of the
 * page and would run under the rail, so the rail steps aside (fades, and leaves the tab order) while
 * a `[data-bleed]` element is level with it.
 */
export function RailShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    const inner = el?.firstElementChild as HTMLElement | null;
    const bleeds = [...document.querySelectorAll("[data-bleed]")];
    if (!el || !inner || bleeds.length === 0) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rail = inner.getBoundingClientRect();
      const away = bleeds.some((b) => {
        const r = b.getBoundingClientRect();
        return r.top < rail.bottom + 16 && r.bottom > rail.top - 16;
      });
      el.dataset.away = away ? "true" : "false";
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    // content that settles late moves the diagram without a scroll
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onScroll);
    ro?.observe(document.getElementById("case-article") ?? document.body);
    return () => {
      ro?.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <aside ref={ref} data-rail aria-label="About this project" className="hidden min-[1100px]:block">
      <div className="case-rail sticky top-[calc(var(--nav-height)+24px)] space-y-6">{children}</div>
    </aside>
  );
}
