"use client";

import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";

export type ShowcaseItem = { slug: string; name: string; tagline: string };

const PLAY_MS = 6500;
const DESKTOP = "(min-width: 1024px)";
const subscribeDesktop = (cb: () => void) => {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/**
 * Desktop (≥ 1024 px): a master/detail "product stage": numbered index on the left (a real ARIA tablist:
 * arrows/Home/End, hover or focus previews), the selected project on a stage on the right, switched with
 * a grid-of-squares wipe. Mobile: the same panels become a swipeable snap deck with grid-square dots.
 * All panels are server-rendered; this shell only decides which one is active.
 */
export function ShowcaseShell({ items, children }: { items: ShowcaseItem[]; children: ReactNode }) {
  const panels = Children.toArray(children);
  const desktop = useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState<string | null>(null);
  const [wipe, setWipe] = useState(0); // key of the running wipe, 0 = none
  const stageRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const timers = useRef<{ play?: number; swap?: number; hover?: number; wipe?: number }>({});
  const wipeKey = useRef(0);

  const play = useCallback((slug: string) => {
    setPlaying(slug);
    window.clearTimeout(timers.current.play);
    timers.current.play = window.setTimeout(() => setPlaying(null), PLAY_MS);
  }, []);

  const select = useCallback(
    (i: number, via: "click" | "key" | "hover" | "deck") => {
      if (i === active) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.clearTimeout(timers.current.swap);
      window.clearTimeout(timers.current.wipe);
      const commit = () => {
        setActive(i);
        play(items[i]!.slug);
      };
      if (via !== "deck" && !reduce && desktop) {
        wipeKey.current += 1;
        setWipe(wipeKey.current);
        timers.current.swap = window.setTimeout(commit, 230); // swap while the squares cover the stage
        timers.current.wipe = window.setTimeout(() => setWipe(0), 900);
      } else {
        commit();
      }
      if (via !== "deck") track("work_select", { project: items[i]!.slug, via });
    },
    [active, desktop, items, play],
  );

  // Play the first sketch once when the section comes into view.
  useEffect(() => {
    const el = stageRef.current ?? deckRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          play(items[0]!.slug);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [items, play]);

  // Mobile deck: whichever card is centred becomes active (dots + sketch playback).
  useEffect(() => {
    const deck = deckRef.current;
    if (!deck || desktop) return;
    const cards = [...deck.children] as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        // On the first client render `desktop` is still false (the server snapshot), so this observer can
        // fire for a hidden card before the layout flips; never let it pick a project on a desktop.
        if (window.matchMedia(DESKTOP).matches) return;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = cards.indexOf(e.target as HTMLElement);
          if (i >= 0) {
            setActive(i);
            play(items[i]!.slug);
          }
        }
      },
      { root: deck, threshold: 0.6 },
    );
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [desktop, items, play]);

  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach((id) => window.clearTimeout(id));
  }, []);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const last = items.length - 1;
    const next =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? (i + 1) % items.length
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? (i - 1 + items.length) % items.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    e.preventDefault();
    tabRefs.current[next]?.focus();
    select(next, "key");
  };

  const goTo = (i: number) => {
    const card = deckRef.current?.children[i] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)] lg:items-start lg:gap-8">
      {/* Index (desktop) */}
      <div className="hidden lg:block">
        <p aria-hidden="true" className="mb-3 font-mono text-xs text-muted">
          <span className="text-accent">$</span> ls ~/work
        </p>
        <ul
          role={desktop ? "tablist" : undefined}
          aria-label={desktop ? "Projects" : undefined}
          aria-orientation={desktop ? "vertical" : undefined}
          className="divide-y divide-border border-y border-border"
        >
          {items.map((it, i) => {
            const on = i === active;
            return (
              <li key={it.slug} role={desktop ? "presentation" : undefined}>
                <button
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  type="button"
                  role={desktop ? "tab" : undefined}
                  id={`tab-${it.slug}`}
                  aria-selected={desktop ? on : undefined}
                  aria-controls={desktop ? `panel-${it.slug}` : undefined}
                  tabIndex={desktop ? (on ? 0 : -1) : undefined}
                  onClick={() => select(i, "click")}
                  onKeyDown={(e) => onKey(e, i)}
                  onPointerEnter={(e) => {
                    if (e.pointerType !== "mouse") return;
                    window.clearTimeout(timers.current.hover);
                    timers.current.hover = window.setTimeout(() => select(i, "hover"), 140);
                  }}
                  onPointerLeave={() => window.clearTimeout(timers.current.hover)}
                  className={cn(
                    "group relative flex w-full items-center gap-4 px-3 py-4 text-left transition-colors",
                    on ? "bg-surface" : "hover:bg-surface/60",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-y-0 left-0 w-0.5 transition-colors",
                      on ? "bg-accent" : "bg-transparent",
                    )}
                  />
                  <span
                    aria-hidden="true"
                    className="idx-num w-14 shrink-0 font-mono text-4xl leading-none font-semibold"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-lg font-semibold",
                        on ? "text-text" : "text-muted group-hover:text-text",
                      )}
                    >
                      {it.name}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-muted">{it.tagline}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    data-l={on ? "4" : "1"}
                    className="rail-sq size-2.5 shrink-0 rounded-[2px]"
                  />
                </button>
              </li>
            );
          })}
        </ul>
        <p aria-hidden="true" className="mt-3 font-mono text-[11px] text-muted">
          ↑ ↓ to browse · hover to preview
        </p>
      </div>

      {/* Stage (desktop) / deck (mobile) */}
      <div className="relative min-w-0" ref={stageRef}>
        {/* `relative` makes the scroller the containing block for sr-only (absolute) text inside off-screen cards,
            otherwise it escapes the scroller and creates page-level horizontal scroll. */}
        <div
          ref={deckRef}
          tabIndex={desktop ? undefined : 0}
          role={desktop ? undefined : "region"}
          aria-label={desktop ? undefined : "Projects, swipe sideways"}
          className="relative -mx-4 flex snap-x snap-mandatory [scroll-padding-inline:16px] [scrollbar-width:none] items-stretch gap-3 overflow-x-auto px-4 pb-3 lg:mx-0 lg:block lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden"
        >
          {panels.map((panel, i) => {
            const slug = items[i]!.slug;
            return (
              <div
                key={slug}
                id={`panel-${slug}`}
                role={desktop ? "tabpanel" : undefined}
                aria-labelledby={desktop ? `tab-${slug}` : undefined}
                data-active={i === active}
                data-play={playing === slug}
                className="w-[86%] shrink-0 snap-center sm:w-[70%] lg:w-auto lg:data-[active=false]:hidden"
              >
                {panel}
              </div>
            );
          })}
        </div>

        {wipe ? (
          <div key={wipe} aria-hidden="true" className="wipe">
            {Array.from({ length: 60 }, (_, n) => (
              <span key={n} style={{ ["--c" as string]: n % 10, ["--r" as string]: Math.floor(n / 10) }} />
            ))}
          </div>
        ) : null}

        {/* Dots made of grid squares (mobile) */}
        <div className="mt-2 flex items-center justify-center gap-1 lg:hidden">
          {items.map((it, i) => (
            <button
              key={it.slug}
              type="button"
              aria-label={`Show ${it.name}`}
              aria-current={i === active ? "true" : undefined}
              onClick={() => goTo(i)}
              className="flex size-8 items-center justify-center"
            >
              <span
                aria-hidden="true"
                data-l={i === active ? "4" : "1"}
                className="rail-sq block size-2.5 rounded-[2px]"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
