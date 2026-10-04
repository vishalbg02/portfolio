"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import {
  HOME,
  LIMITS,
  TONE,
  TOWER,
  blockPolys,
  boxPolys,
  buildCity,
  centreOn,
  clamp,
  fitCamera,
  hitTest,
  lerpCamera,
  paintOrder,
  project,
  shade,
  stagger,
  type Camera,
  type CityBlock,
  type Landmark,
} from "@/lib/city/iso";
import { describeDay } from "@/lib/github/calendar";
import type { Mark } from "@/lib/github/marks";
import type { ContributionDay } from "@/lib/github/types";

/** Below this width labels become numbered pins with a list underneath, so nothing overlaps on a phone. */
const WIDE = 900;
const LABEL_H = 26;
const STEP_YAW = 0.2;
const STEP_PITCH = 0.07;

const IDENTITY: Record<string, string> = {
  "golden-verdict": "--id-golden-verdict",
  talnio: "--id-talnio",
  lansymphony: "--id-lansymphony",
  "virtual-tour": "--id-virtual-tour",
};

/** The tokens the canvas paints with, read once from the page's CSS so the palette has one source. */
type Palette = {
  bg: string;
  surface: string;
  border: string;
  text: string;
  accent: string;
  levels: [string, string, string, string, string];
  identity: Record<string, string>;
};
function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const tok = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    bg: tok("--bg", "#0d1117"),
    surface: tok("--surface", "#161b22"),
    border: tok("--border", "#30363d"),
    text: tok("--text", "#e6edf3"),
    accent: tok("--accent", "#3fb950"),
    levels: [
      tok("--grid-0", "#161b22"),
      tok("--grid-1", "#0e4429"),
      tok("--grid-2", "#006d32"),
      tok("--grid-3", "#26a641"),
      tok("--grid-4", "#39d353"),
    ],
    identity: Object.fromEntries(Object.entries(IDENTITY).map(([k, v]) => [k, tok(v, "#e6edf3")])),
  };
}

const slugOf = (href?: string) => href?.match(/^\/work\/([a-z-]+)/)?.[1];

type Placed = { id: string; x: number; y: number; width: number; tier: number; topX: number; topY: number };

/**
 * The year as an isometric city, drawn on a canvas by a small projection (lib/city/iso.ts): each day is a flat-shaded
 * block whose height is its contributions, in the contribution-graph greens; each award is a taller tower in its
 * project's colour with a label. Drag to rotate and tilt, Ctrl + scroll or the buttons to zoom, tap a block for its
 * count, tap a tower to fly there and read its story. It redraws only when something changes (no idle loop), so it
 * costs nothing while you read. Arrow keys, + / − and 0 do the same from the keyboard, and under reduced motion the
 * camera jumps instead of flying. Loaded only when the 3D view is switched on.
 */
export default function CommitCity({
  weeks,
  pins,
  label,
}: {
  weeks: ContributionDay[][];
  pins: Mark[];
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const pinEls = useRef(new Map<string, HTMLElement>());
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [openId, setOpenId] = useState<string | null>(null);

  const awards = useMemo(() => pins.filter((p) => p.kind === "award" && p.week !== undefined), [pins]);
  const peaks = useMemo(() => pins.filter((p) => p.kind === "peak" && p.week !== undefined), [pins]);
  const landmarks = useMemo<Landmark[]>(
    () => awards.map((a) => ({ id: a.id, week: a.week!, day: a.day!, color: slugOf(a.href) ?? "" })),
    [awards],
  );
  const city = useMemo(() => buildCity(weeks, landmarks), [weeks, landmarks]);
  const grid = useMemo(() => ({ cols: city.cols, rows: city.rows }), [city]);
  const wide = size.w >= WIDE;
  const fit = useMemo(
    () => (size.w ? fitCamera({ w: size.w, h: size.h }, grid, wide ? 56 : 24) : null),
    [size, grid, wide],
  );

  // everything the draw loop needs, outside React state: it changes on every frame of a drag or a flight
  const live = useRef({
    cam: { ...HOME } as Camera,
    home: { ...HOME } as Camera,
    scale: 12,
    hover: null as CityBlock | null,
    placed: [] as Placed[],
    raf: 0,
    flight: 0,
    palette: null as Palette | null,
  });

  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const draw = useCallback(() => {
    const cv = canvas.current;
    const L = live.current;
    if (!cv || !L.palette || !size.w) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const P = L.palette;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(size.w * dpr) || cv.height !== Math.round(size.h * dpr)) {
      cv.width = Math.round(size.w * dpr);
      cv.height = Math.round(size.h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.lineJoin = "round";
    const view = { w: size.w, h: size.h };
    const { cam, scale } = L;
    const poly = (pts: Array<{ x: number; y: number }>, fill: string, stroke?: string, lw = 0.6) => {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.lineWidth = lw;
        ctx.strokeStyle = stroke;
        ctx.stroke();
      }
    };
    const pr = (x: number, y: number, z: number) => project({ x, y, z }, cam, view, grid, scale);

    // the ground the city stands on: a flat slab, drawn as a wide, low box
    const slab = boxPolys(
      { x0: -0.6, x1: grid.cols + 0.6, y0: -0.6, y1: grid.rows + 0.6, z0: -0.5, z1: 0 },
      cam,
      view,
      grid,
      scale,
    );
    for (const side of slab.sides) poly(side.pts, shade(P.border, TONE[side.face.tone]), P.bg);
    poly(slab.top, P.bg, P.border, 1);

    const order = paintOrder(city.blocks, cam, grid);
    for (const idx of order) {
      const b = city.blocks[idx]!;
      const base = b.landmark ? (P.identity[b.landmark.color] ?? P.text) : P.levels[b.level]!;
      const { top, sides } = blockPolys(b, cam, view, grid, scale);
      for (const s of sides) poly(s.pts, shade(base, TONE[s.face.tone]), P.bg);
      poly(top, base, P.bg);
    }

    // peak days wear a small flag (the accent colour) so the busiest days read at a glance
    for (const pk of peaks) {
      const b = city.blocks.find((x) => x.week === pk.week && x.day === pk.day);
      if (!b) continue;
      const t = pr(b.week + 0.5, b.day + 0.5, b.z);
      poly(
        [
          { x: t.x, y: t.y - 14 },
          { x: t.x + 5, y: t.y - 9 },
          { x: t.x, y: t.y - 4 },
          { x: t.x - 5, y: t.y - 9 },
        ],
        P.accent,
        P.bg,
        1,
      );
    }

    if (L.hover) {
      const { top } = blockPolys(L.hover, cam, view, grid, scale);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = P.text;
      ctx.beginPath();
      top.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();
    }

    // landmark labels (or numbered pins on a narrow screen), staggered so none overlap, with leader lines
    const items = awards.map((a, n) => {
      const t = pr(a.week! + 0.5, a.day! + 0.5, TOWER);
      const width = wide ? Math.min(250, 34 + a.short.length * 6.6) : 26;
      return { a, n, t, width };
    });
    const tiers = wide
      ? stagger(
          items.map((it) => ({ x: it.t.x - 12, width: it.width })),
          10,
        )
      : items.map(() => 0);
    const placed: Placed[] = items.map((it, i) => {
      const x = clamp(it.t.x - 12, [6, Math.max(6, size.w - it.width - 6)]);
      const y = Math.max(4, it.t.y - 30 - tiers[i]! * (LABEL_H + 6));
      return { id: it.a.id, x, y, width: it.width, tier: tiers[i]!, topX: it.t.x, topY: it.t.y };
    });
    L.placed = placed;
    ctx.lineWidth = 1;
    ctx.strokeStyle = P.border;
    for (const p of placed) {
      ctx.beginPath();
      ctx.moveTo(p.topX, p.topY - 2);
      ctx.lineTo(p.topX, p.y + LABEL_H);
      ctx.stroke();
    }
    for (const p of placed) {
      const el = pinEls.current.get(p.id);
      if (el) el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
    }

    if (box.current) {
      box.current.dataset.yaw = cam.yaw.toFixed(3);
      box.current.dataset.pitch = cam.pitch.toFixed(3);
      box.current.dataset.zoom = cam.zoom.toFixed(2);
    }
  }, [awards, city, grid, peaks, size, wide]);

  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);
  const schedule = useCallback(() => {
    const L = live.current;
    if (L.raf) return;
    L.raf = requestAnimationFrame(() => {
      L.raf = 0;
      drawRef.current();
    });
  }, []);

  // a changed size or data redraws with the new geometry
  useEffect(() => {
    schedule();
  }, [draw, schedule]);

  const setCam = useCallback(
    (next: Camera) => {
      live.current.cam = {
        ...next,
        pitch: clamp(next.pitch, LIMITS.pitch),
        zoom: clamp(next.zoom, LIMITS.zoom),
      };
      schedule();
    },
    [schedule],
  );

  const fly = useCallback(
    (to: Camera) => {
      const L = live.current;
      cancelAnimationFrame(L.flight);
      if (reduced()) return setCam(to);
      const from = L.cam;
      const t0 = performance.now();
      const step = (now: number) => {
        const t = (now - t0) / 520;
        setCam(lerpCamera(from, to, t));
        if (t < 1) L.flight = requestAnimationFrame(step);
      };
      L.flight = requestAnimationFrame(step);
    },
    [setCam],
  );

  // size: the canvas follows its box
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      setSize({
        w,
        h: w >= WIDE ? Math.round(Math.min(440, w * 0.36)) : Math.round(Math.max(300, w * 0.85)),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // a (re)fitted camera whenever the box or the data changes
  useEffect(() => {
    const L = live.current;
    if (!fit) return;
    L.palette = L.palette ?? readPalette();
    L.scale = fit.scale;
    L.home = fit.home;
    L.cam = { ...fit.home };
    schedule();
  }, [fit, schedule]);

  useEffect(() => {
    const L = live.current;
    return () => {
      // zero the flag as well as cancelling: React strict mode mounts, unmounts and mounts again, and a stale
      // "a frame is pending" flag would stop anything from ever being drawn
      cancelAnimationFrame(L.raf);
      cancelAnimationFrame(L.flight);
      L.raf = 0;
      L.flight = 0;
    };
  }, []);

  // Ctrl or Cmd + wheel (a trackpad pinch sends this) zooms. A plain wheel scrolls the page: it is never trapped.
  // A native, non-passive listener, because React's own wheel handlers can't cancel the browser's page zoom.
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const c = live.current.cam;
      setCam({ ...c, zoom: c.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12) });
    };
    cv.addEventListener("wheel", onWheel, { passive: false });
    return () => cv.removeEventListener("wheel", onWheel);
  }, [setCam]);

  const toolbar = useMemo(
    () => [
      { label: "Rotate left", glyph: "↶", act: (c: Camera) => ({ ...c, yaw: c.yaw - STEP_YAW * 2 }) },
      { label: "Rotate right", glyph: "↷", act: (c: Camera) => ({ ...c, yaw: c.yaw + STEP_YAW * 2 }) },
      { label: "Zoom out", glyph: "−", act: (c: Camera) => ({ ...c, zoom: c.zoom / 1.25 }) },
      { label: "Zoom in", glyph: "+", act: (c: Camera) => ({ ...c, zoom: c.zoom * 1.25 }) },
    ],
    [],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    const c = live.current.cam;
    const keys: Record<string, Camera | undefined> = {
      ArrowLeft: { ...c, yaw: c.yaw - STEP_YAW },
      ArrowRight: { ...c, yaw: c.yaw + STEP_YAW },
      ArrowUp: { ...c, pitch: c.pitch + STEP_PITCH },
      ArrowDown: { ...c, pitch: c.pitch - STEP_PITCH },
      "+": { ...c, zoom: c.zoom * 1.2 },
      "=": { ...c, zoom: c.zoom * 1.2 },
      "-": { ...c, zoom: c.zoom / 1.2 },
      "0": live.current.home,
    };
    if (e.key === "Escape" && openId) {
      e.stopPropagation();
      setOpenId(null);
      return;
    }
    const next = keys[e.key];
    if (!next) return;
    e.preventDefault();
    fly(next);
  };

  // pointer: drag to rotate (a mouse also tilts), tap a block for its count, tap a tower for its story
  const drag = useRef<{ x: number; y: number; cam: Camera; moved: boolean; id: number } | null>(null);
  const local = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const pick = (x: number, y: number) => {
    const L = live.current;
    const order = paintOrder(city.blocks, L.cam, grid);
    return hitTest(city.blocks, order, L.cam, { w: size.w, h: size.h }, grid, L.scale, x, y);
  };
  const showTip = (b: CityBlock | null, x: number, y: number) => {
    const el = tip.current;
    if (!el) return;
    if (!b) {
      el.style.visibility = "hidden";
      return;
    }
    const day = weeks[b.week]?.find((d) => d.date === b.date);
    el.textContent = day ? describeDay(day) : b.date;
    el.style.visibility = "visible";
    el.style.transform = `translate(${Math.round(Math.min(x + 14, size.w - 230))}px, ${Math.round(Math.max(4, y - 34))}px)`;
  };
  const setHover = (b: CityBlock | null) => {
    if (live.current.hover === b) return;
    live.current.hover = b;
    schedule();
  };

  const openLandmark = (id: string) => {
    const a = awards.find((m) => m.id === id);
    if (!a) return;
    const L = live.current;
    const target = centreOn(
      { x: a.week! + 0.5, y: a.day! + 0.5, z: TOWER * 0.6 },
      { ...L.cam },
      { w: size.w, h: size.h },
      grid,
      L.scale,
      Math.max(L.cam.zoom, 1.7),
    );
    fly(target);
    setOpenId(id);
    track("milestone_open", { kind: "award" });
  };

  const opened = awards.find((a) => a.id === openId) ?? null;

  return (
    <div>
      <div
        ref={box}
        data-testid="city"
        data-yaw=""
        role="group"
        tabIndex={0}
        aria-roledescription="3D view"
        aria-label={`${label} Drag to rotate, or use the arrow keys. Plus and minus zoom, zero resets.`}
        onKeyDown={onKeyDown}
        className="relative overflow-hidden rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link"
        style={{ height: size.h || 360 }}
      >
        <canvas
          ref={canvas}
          data-testid="city-canvas"
          data-cursor="drag"
          aria-hidden="true"
          style={{ width: size.w, height: size.h, touchAction: "pan-y", cursor: "grab" }}
          className="block"
          onPointerDown={(e) => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { ...local(e), cam: { ...live.current.cam }, moved: false, id: e.pointerId };
            cancelAnimationFrame(live.current.flight);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            const at = local(e);
            if (d && d.id === e.pointerId) {
              const dx = at.x - d.x;
              const dy = at.y - d.y;
              if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
              if (d.moved) {
                showTip(null, 0, 0);
                setHover(null);
                setCam({
                  ...d.cam,
                  yaw: d.cam.yaw - dx * 0.008,
                  pitch: e.pointerType === "touch" ? d.cam.pitch : d.cam.pitch + dy * 0.004,
                });
              }
              return;
            }
            if (e.pointerType !== "mouse") return;
            const b = pick(at.x, at.y);
            setHover(b);
            showTip(b, at.x, at.y);
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            drag.current = null;
            if (!d || d.moved) return;
            const at = local(e);
            const b = pick(at.x, at.y);
            if (b?.landmark) return openLandmark(b.landmark.id);
            setHover(b);
            showTip(b, at.x, at.y);
            if (e.pointerType !== "mouse")
              window.setTimeout(() => {
                setHover(null);
                showTip(null, 0, 0);
              }, 2400);
          }}
          onPointerCancel={() => (drag.current = null)}
          onPointerLeave={() => {
            if (!drag.current) {
              setHover(null);
              showTip(null, 0, 0);
            }
          }}
        />

        <div
          ref={tip}
          aria-hidden="true"
          style={{ visibility: "hidden" }}
          className="pointer-events-none absolute top-0 left-0 z-20 rounded-sm border border-border-2 bg-bg px-2 py-1 font-mono text-[11px] whitespace-nowrap text-text"
        />

        {awards.map((a, n) => {
          const slug = slugOf(a.href);
          const dot = slug ? `var(${IDENTITY[slug]})` : "var(--text)";
          return (
            <button
              key={a.id}
              ref={(el) => {
                if (el) pinEls.current.set(a.id, el);
                else pinEls.current.delete(a.id);
              }}
              type="button"
              data-landmark={a.id}
              data-cursor="open"
              aria-expanded={openId === a.id}
              aria-label={`${a.title}, ${a.when}. ${wide ? "Fly to it" : `Pin ${n + 1}`}`}
              onClick={() => openLandmark(a.id)}
              style={{ position: "absolute", top: 0, left: 0, transform: "translate(-999px, 0)" }}
              className="z-10 inline-flex h-[26px] items-center gap-1.5 rounded-sm border border-border-2 bg-bg px-1.5 font-mono text-[11px] text-text transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-link"
            >
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-[2px]"
                style={{ background: dot }}
              />
              {wide ? (
                <span className="truncate">{a.short}</span>
              ) : (
                <span className="tabular-nums">{n + 1}</span>
              )}
            </button>
          );
        })}

        <div role="group" aria-label="3D view controls" className="absolute top-2 right-2 z-20 flex gap-1">
          {toolbar.map((b) => (
            <button
              key={b.label}
              type="button"
              aria-label={b.label}
              title={b.label}
              onClick={() => fly(b.act(live.current.cam))}
              className="inline-flex size-8 items-center justify-center rounded-sm border border-border bg-bg font-mono text-sm text-text transition-colors hover:border-border-2 pointer-coarse:size-11"
            >
              {b.glyph}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setOpenId(null);
              fly(live.current.home);
            }}
            className="inline-flex h-8 items-center rounded-sm border border-border bg-bg px-2.5 font-mono text-xs text-text transition-colors hover:border-border-2 pointer-coarse:h-11"
          >
            Reset
          </button>
        </div>
        <p
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2 left-3 z-10 font-mono text-[11px] text-muted max-sm:hidden"
        >
          Drag to rotate · Ctrl + scroll to zoom · tap a tower
        </p>
      </div>

      {opened ? (
        <section
          aria-label={opened.title}
          data-testid="city-story"
          className="mt-3 rounded-card border border-border bg-bg p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-text">{opened.title}</h3>
              <p className="mt-0.5 font-mono text-xs text-muted">{opened.when}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="inline-flex min-h-8 shrink-0 items-center rounded-sm border border-border px-2.5 font-mono text-xs text-muted transition-colors hover:text-text pointer-coarse:min-h-11"
            >
              Close
            </button>
          </div>
          <p className="mt-2 text-sm text-muted">{opened.story}</p>
          {opened.href ? (
            <Link
              href={opened.href}
              className="mt-2 inline-block font-mono text-xs text-link underline-offset-4 hover:underline"
            >
              See the proof →
            </Link>
          ) : null}
        </section>
      ) : null}

      {!wide && awards.length ? (
        <ol className="mt-3 space-y-1" aria-label="Towers in this city">
          {awards.map((a, n) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => openLandmark(a.id)}
                className="flex min-h-11 w-full items-center gap-3 rounded-sm text-left text-sm text-text"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm border border-border-2 font-mono text-[11px] tabular-nums"
                >
                  {n + 1}
                </span>
                <span className="min-w-0 flex-1">{a.title}</span>
                <span className="shrink-0 font-mono text-xs text-muted">{a.when}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
