"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { track } from "@/lib/analytics";
import type { ViewerItem } from "./viewer-types";
import { cn } from "@/lib/utils/cn";
import { identityBg } from "../identity";

const MediaViewer = dynamic(() => import("./MediaViewer").then((m) => m.MediaViewer), { ssr: false });

export type SceneInfo = {
  slug: string;
  name: string;
  beats: number;
  /** For each beat, the index of its still in the viewer (or -1 when the beat is an illustration). */
  beatItem: number[];
};

const PINNED = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";
const DECK = "(max-width: 1023.98px)";
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Drives the Work section. The markup is server-rendered (Scene.tsx); this only moves between scenes and
 * beats and never renders them:
 *  - desktop (pinned): native scroll through a tall section scrubs scene and beat, and a scene change is a
 *    pixel dissolve. No scroll-jacking, no wheel handlers: it only reads where the page is.
 *  - phone (deck): the card in the middle of the snap row becomes active (its clip plays, the dots follow).
 *  - without JS or with reduced motion: the scenes are plain rows and nothing moves by itself.
 * Keys when the stage has focus: ↑/↓ scenes, ←/→ beats, 1–4 a scene. Everything is also reachable by tab.
 */
export function ShowcaseController({
  scenes,
  viewer,
  children,
}: {
  scenes: SceneInfo[];
  viewer: Record<string, ViewerItem[]>;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [viewing, setViewing] = useState<{ slug: string; index: number } | null>(null);
  /** What to give focus back to when the viewer closes: the button that opened it. */
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const sceneEls = [...el.querySelectorAll<HTMLElement>(".scene")];
    const pin = el.querySelector<HTMLElement>(".work-pin")!;
    const stick = el.querySelector<HTMLElement>(".work-stick")!;
    const stage = el.querySelector<HTMLElement>(".work-stage")!;
    const pinnedMq = window.matchMedia(PINNED);
    const deckMq = window.matchMedia(DECK);
    const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");

    let scene = 0;
    const beat = scenes.map(() => 0);
    const userPaused = new WeakSet<HTMLVideoElement>();
    const userPlayed = new WeakSet<HTMLVideoElement>();
    let onScreen = true;
    let busy = false;
    let again = false;
    let dissolveMod: Promise<typeof import("@/lib/fx/dissolve")> | null = null;

    const navHeight = () =>
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-height")) || 56;

    /* ── state → DOM ─────────────────────────────────────────────────────────────────────────── */
    const syncClips = () => {
      el.querySelectorAll<HTMLVideoElement>("video[data-clip]").forEach((v) => {
        const card = v.closest<HTMLElement>(".scene");
        const shown = Boolean(card?.hasAttribute("data-active")) && v.offsetParent !== null;
        const want = onScreen && shown && ((!reduceMq.matches && !userPaused.has(v)) || userPlayed.has(v));
        if (want && v.paused) void v.play().catch(() => {});
        else if (!want && !v.paused) v.pause();
        const btn = v.parentElement?.querySelector<HTMLButtonElement>("[data-clip-toggle]");
        if (btn) {
          const playing = want;
          btn.setAttribute("aria-label", playing ? "Pause video" : "Play video");
          btn.setAttribute("aria-pressed", String(playing));
          btn.querySelector("[data-clip-label]")!.textContent = playing ? "Pause" : "Play";
          btn.querySelector("[data-clip-icon]")!.textContent = playing ? "❚❚" : "▶";
        }
      });
    };

    const setBeat = (i: number, j: number) => {
      const card = sceneEls[i];
      if (!card) return;
      beat[i] = j;
      card.querySelectorAll<HTMLElement>(".beat, .beat-list li").forEach((n) => {
        n.toggleAttribute("data-active", Number(n.dataset.beat) === j);
      });
      card.querySelectorAll<HTMLButtonElement>("[data-beat-go]").forEach((b) => {
        if (Number(b.dataset.beatGo) === j) b.setAttribute("aria-current", "step");
        else b.removeAttribute("aria-current");
      });
    };

    const showScene = (i: number, announce = true) => {
      const changed = i !== scene;
      scene = i;
      sceneEls.forEach((card, k) => {
        card.toggleAttribute("data-active", k === i);
        card.toggleAttribute("data-warm", Math.abs(k - i) === 1);
      });
      setActive(i);
      syncClips();
      if (changed && announce) track("scene_view", { project: scenes[i]!.slug });
    };

    /* ── scroll → scene and beat (desktop) ───────────────────────────────────────────────────── */
    const range = () => Math.max(1, pin.offsetHeight - stick.offsetHeight);
    const pinTop = () => pin.getBoundingClientRect().top + window.scrollY - navHeight();

    const read = () => {
      const p = clamp((window.scrollY - pinTop()) / range(), 0, 1);
      const n = scenes.length;
      const s = Math.min(n - 1, Math.floor(p * n));
      const local = p * n - s;
      const b = Math.min(scenes[s]!.beats - 1, Math.floor(local * scenes[s]!.beats));
      return { s, b };
    };

    const follow = async () => {
      if (!pinnedMq.matches) return;
      if (busy) {
        again = true;
        return;
      }
      const { s, b } = read();
      if (s !== scene) {
        busy = true;
        dissolveMod ??= import("@/lib/fx/dissolve");
        try {
          const { dissolve } = await dissolveMod;
          await dissolve(stage, () => {
            showScene(s);
            setBeat(s, b);
          });
        } finally {
          busy = false;
        }
        if (again) {
          again = false;
          void follow();
        }
      } else if (b !== beat[s]) {
        setBeat(s, b);
      }
    };

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        void follow();
      });
    };

    /* ── going somewhere ─────────────────────────────────────────────────────────────────────── */
    const behavior = (): ScrollBehavior => (reduceMq.matches ? "auto" : "smooth");
    const goScene = (i: number, j = 0) => {
      const n = scenes.length;
      const k = clamp(i, 0, n - 1);
      if (pinnedMq.matches) {
        const b = scenes[k]!.beats;
        window.scrollTo({
          top: pinTop() + ((k + (clamp(j, 0, b - 1) + 0.5) / b) / n) * range(),
          behavior: behavior(),
        });
      } else if (deckMq.matches) {
        sceneEls[k]!.scrollIntoView({ behavior: behavior(), inline: "center", block: "nearest" });
      } else {
        sceneEls[k]!.scrollIntoView({ behavior: behavior(), block: "start" });
      }
    };

    /* ── events ──────────────────────────────────────────────────────────────────────────────── */
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const go = t.closest<HTMLElement>("[data-go]");
      if (go) return goScene(Number(go.dataset.go));

      const bg = t.closest<HTMLElement>("[data-beat-go]");
      if (bg) {
        const card = bg.closest<HTMLElement>(".scene")!;
        const i = Number(card.dataset.scene);
        const j = Number(bg.dataset.beatGo);
        if (pinnedMq.matches) goScene(i, j);
        else setBeat(i, j);
        return;
      }

      const toggle = t.closest<HTMLElement>("[data-clip-toggle]");
      if (toggle) {
        const v = toggle.parentElement?.querySelector<HTMLVideoElement>("video");
        if (v) {
          if (v.paused) {
            userPaused.delete(v);
            userPlayed.add(v);
          } else {
            userPlayed.delete(v);
            userPaused.add(v);
          }
          syncClips();
        }
        return;
      }

      const live = t.closest<HTMLElement>("[data-live-launch]");
      if (live) {
        const card = live.closest<HTMLElement>(".scene")!;
        const slot = [...card.querySelectorAll<HTMLElement>("[data-live-slot]")].find(
          (s) => s.parentElement!.offsetParent !== null,
        );
        if (slot) {
          void import("@/lib/work/live-tour").then(({ launchLiveTour }) => {
            if (launchLiveTour(slot, live.dataset.liveLaunch!))
              track("demo_launch", { project: "virtual-tour" });
          });
        }
        return;
      }

      const open = t.closest<HTMLElement>("[data-viewer-open]");
      const hero = t.closest<HTMLElement>(".scene-hero");
      const target = open ?? (deckMq.matches ? hero : null);
      if (target) {
        const card = target.closest<HTMLElement>(".scene")!;
        const i = Number(card.dataset.scene);
        const slug = scenes[i]!.slug;
        if (!viewer[slug]?.length) return;
        const start = scenes[i]!.beatItem[beat[i]!] ?? -1;
        // a tap on the media has no button to return to: use the card's full-screen button
        opener.current = open ?? card.querySelector<HTMLElement>("[data-viewer-open]");
        setViewing({ slug, index: Math.max(0, start) });
        track("media_fullscreen", { project: slug });
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const n = scenes.length;
      if (/^[1-9]$/.test(e.key) && Number(e.key) <= n && e.target === stage) {
        e.preventDefault();
        return goScene(Number(e.key) - 1);
      }
      if (!pinnedMq.matches || e.target !== stage) return;
      const b = scenes[scene]!.beats;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        goScene(scene + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        goScene(scene - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (beat[scene]! < b - 1) goScene(scene, beat[scene]! + 1);
        else goScene(scene + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (beat[scene]! > 0) goScene(scene, beat[scene]! - 1);
        else if (scene > 0) goScene(scene - 1, scenes[scene - 1]!.beats - 1);
      }
    };

    el.addEventListener("click", onClick);
    el.addEventListener("keydown", onKey);

    /* ── observers ───────────────────────────────────────────────────────────────────────────── */
    // Read the page's scroll only while the section is near the viewport.
    let listening = false;
    const listen = (on: boolean) => {
      if (on === listening) return;
      listening = on;
      if (on) window.addEventListener("scroll", onScroll, { passive: true });
      else window.removeEventListener("scroll", onScroll);
    };
    const nearIo = new IntersectionObserver(
      ([entry]) => {
        onScreen = Boolean(entry?.isIntersecting);
        listen(onScreen && pinnedMq.matches);
        if (onScreen) onScroll();
        syncClips();
      },
      { rootMargin: "200px 0px" },
    );
    nearIo.observe(el);

    // Deck: the card in the middle of the snap row is the active one.
    const deckIo = new IntersectionObserver(
      (entries) => {
        if (!deckMq.matches) return;
        for (const e of entries) {
          if (e.isIntersecting) showScene(sceneEls.indexOf(e.target as HTMLElement));
        }
      },
      { root: el.querySelector(".work-scenes"), threshold: 0.6 },
    );
    sceneEls.forEach((card) => deckIo.observe(card));

    const onMode = () => {
      listen(onScreen && pinnedMq.matches);
      if (pinnedMq.matches) onScroll();
      syncClips();
    };
    pinnedMq.addEventListener("change", onMode);
    deckMq.addEventListener("change", onMode);
    reduceMq.addEventListener("change", onMode);
    window.addEventListener("resize", syncClips);

    onMode();
    return () => {
      el.removeEventListener("click", onClick);
      el.removeEventListener("keydown", onKey);
      nearIo.disconnect();
      deckIo.disconnect();
      listen(false);
      cancelAnimationFrame(raf);
      pinnedMq.removeEventListener("change", onMode);
      deckMq.removeEventListener("change", onMode);
      reduceMq.removeEventListener("change", onMode);
      window.removeEventListener("resize", syncClips);
      el.querySelectorAll("video").forEach((v) => v.pause());
    };
  }, [scenes, viewer]);

  const close = useCallback(() => {
    setViewing(null);
    const back = opener.current;
    opener.current = null;
    // after the dialog has unmounted
    window.requestAnimationFrame(() => back?.focus());
  }, []);

  return (
    <>
      <div ref={root} className="work" style={{ "--scenes": scenes.length } as CSSProperties}>
        <div className="work-pin">
          <div className="work-stick">
            <div
              className="work-stage"
              tabIndex={0}
              role="group"
              aria-roledescription="project showcase"
              aria-label={`Selected work, ${scenes.length} projects. With this focused, use the arrow keys or the numbers 1 to ${scenes.length}.`}
            >
              <div className="work-scenes" tabIndex={-1}>
                {children}
              </div>
              <nav className="work-index" aria-label="Projects">
                <span aria-hidden="true" className="work-count font-mono text-xs text-muted">
                  {String(active + 1).padStart(2, "0")} / {String(scenes.length).padStart(2, "0")}
                </span>
                {scenes.map((s, i) => (
                  <button
                    key={s.slug}
                    type="button"
                    data-go={i}
                    aria-label={`${String(i + 1).padStart(2, "0")} ${s.name}`}
                    aria-current={i === active ? "true" : undefined}
                  >
                    <span
                      aria-hidden="true"
                      data-on={i === active}
                      className={cn("sq", identityBg[s.slug as keyof typeof identityBg])}
                    />
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </div>
      {viewing ? (
        <MediaViewer
          name={scenes.find((s) => s.slug === viewing.slug)!.name}
          items={viewer[viewing.slug]!}
          start={viewing.index}
          onClose={close}
        />
      ) : null}
    </>
  );
}
