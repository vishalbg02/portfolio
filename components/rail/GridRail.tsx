"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";
import { activeSection, railLevels, scrollProgress, spreadTicks, tickFractions } from "@/lib/utils/rail";

export type RailSection = { id: string; label: string };

const SQUARES = 30;

/**
 * The Grid Rail: a column of contribution squares fixed to the left edge that fills as you scroll,
 * with a labelled tick per section (hover/focus shows the name, click/Enter jumps). Below 1024 px it
 * collapses to a 2 px green progress line along the top. One passive scroll listener, no layout reads
 * in the scroll path (offsets are measured on mount/resize), transforms/attributes only: no CLS.
 */
export default function GridRail({ sections }: { sections: RailSection[] }) {
  const squares = useRef<Array<HTMLSpanElement | null>>([]);
  const ticks = useRef<Array<HTMLAnchorElement | null>>([]);
  const bar = useRef<HTMLDivElement>(null);
  const railEl = useRef<HTMLElement>(null);

  useEffect(() => {
    let tops: number[] = [];
    let fractions: number[] = [];
    let docH = 1;
    let active = -2;
    let ticking = false;

    const measure = () => {
      docH = document.documentElement.scrollHeight;
      const base = window.scrollY;
      tops = sections.map((s) => {
        const el = document.getElementById(s.id);
        return el ? el.getBoundingClientRect().top + base : Number.POSITIVE_INFINITY;
      });
      fractions = spreadTicks(
        tickFractions(
          tops.map((t) => (Number.isFinite(t) ? t : 0)),
          docH,
          window.innerHeight,
        ),
        railEl.current?.offsetHeight ?? 0,
      );
      ticks.current.forEach((t, i) => {
        if (!t) return;
        t.style.top = `${(fractions[i] ?? 0) * 100}%`;
        t.style.display = Number.isFinite(tops[i]) ? "" : "none"; // section not on this page
      });
      update();
    };

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const p = scrollProgress(y, docH, window.innerHeight);
      railLevels(p, SQUARES).forEach((lvl, i) => {
        const sq = squares.current[i];
        if (sq && sq.dataset.l !== String(lvl)) sq.dataset.l = String(lvl);
      });
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
      const next = activeSection(tops, y, window.innerHeight * 0.4);
      if (next !== active) {
        active = next;
        ticks.current.forEach((t, i) => {
          if (!t) return;
          if (i === next) {
            t.setAttribute("aria-current", "location");
            t.dataset.pulse = "";
            // restart the one-shot pulse
            t.classList.remove("rail-pulse");
            void t.offsetWidth;
            t.classList.add("rail-pulse");
          } else {
            t.removeAttribute("aria-current");
          }
        });
      }
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    const settle = window.setTimeout(measure, 800); // late layout (fonts, images, lazy sections)
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      ro.disconnect();
      window.clearTimeout(settle);
    };
  }, [sections]);

  const jump = (e: React.MouseEvent<HTMLAnchorElement>, s: RailSection) => {
    const el = document.getElementById(s.id);
    if (!el) return;
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${s.id}`);
    track("rail_jump", { section: s.id });
  };

  return (
    <>
      {/* Mobile / tablet: a 2px progress line along the top */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 lg:hidden">
        <div ref={bar} className="h-full origin-left scale-x-0 bg-accent will-change-transform" />
      </div>

      {/* Desktop: the rail */}
      <nav
        ref={railEl}
        aria-label="Page progress"
        className="fixed top-1/2 left-2.5 z-30 hidden h-[min(60vh,456px)] -translate-y-1/2 lg:block"
      >
        <div aria-hidden="true" className="flex h-full flex-col justify-between">
          {Array.from({ length: SQUARES }, (_, i) => (
            <span
              key={i}
              ref={(el) => {
                squares.current[i] = el;
              }}
              data-l="0"
              className="rail-sq block size-2.5 rounded-[2px]"
            />
          ))}
        </div>
        {sections.map((s, i) => (
          <a
            key={s.id}
            ref={(el) => {
              ticks.current[i] = el;
            }}
            href={`#${s.id}`}
            onClick={(e) => jump(e, s)}
            aria-label={`Jump to ${s.label}`}
            data-label={s.label}
            className="rail-tick absolute -left-1.5 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          >
            <span aria-hidden="true" className="rail-tick-dot block h-0.5 w-4 rounded-pill bg-text/60" />
          </a>
        ))}
      </nav>
    </>
  );
}
