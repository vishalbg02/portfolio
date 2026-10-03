"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { newGame, step, tickMs, turn, type Dir, type SnakeState } from "@/lib/games/snake";

const COLS = 20;
const ROWS = 20;
const CELL = 18;
const SIZE = COLS * CELL;
const BEST_KEY = "snake-best";

// Flat design-token colors (no gradients).
const C = { bg: "#0d1117", grid: "#161b22", snake: "#3fb950", head: "#39d353", food: "#e6edf3" };

const KEYS: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

type Phase = "idle" | "playing" | "paused" | "over";

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function draw(ctx: CanvasRenderingContext2D, s: SnakeState) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = C.grid;
  for (let x = 0; x < COLS; x++)
    for (let y = 0; y < ROWS; y++) if ((x + y) % 2 === 0) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
  if (s.food) {
    ctx.fillStyle = C.food;
    ctx.fillRect(s.food.x * CELL + 4, s.food.y * CELL + 4, CELL - 8, CELL - 8);
  }
  s.snake.forEach((p, i) => {
    ctx.fillStyle = i === 0 ? C.head : C.snake;
    ctx.fillRect(p.x * CELL + 1, p.y * CELL + 1, CELL - 2, CELL - 2);
  });
}

/** Snake for the 404 page: arrows/WASD, swipe, or the on-screen pad. Loads only when asked for. */
export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const game = useRef<SnakeState>(newGame(COLS, ROWS));
  const timer = useRef<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const [score, setScore] = useState(0);
  // Client-only component (loaded with ssr:false), so reading localStorage in the initializer is safe.
  const [best, setBest] = useState(readBest);
  const loopRef = useRef<() => void>(() => {});
  const touch = useRef<{ x: number; y: number } | null>(null);
  const announced = useRef(false);

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const render = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) draw(ctx, game.current);
  }, []);

  const stop = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const loop = useCallback(() => {
    game.current = step(game.current);
    const s = game.current;
    setScore(s.score);
    render();
    if (!s.alive) {
      stop();
      setPhaseBoth("over");
      setBest((b) => {
        const nb = Math.max(b, s.score);
        try {
          localStorage.setItem(BEST_KEY, String(nb));
        } catch {
          /* private mode: the best score just isn't remembered */
        }
        return nb;
      });
      return;
    }
    timer.current = window.setTimeout(() => loopRef.current(), tickMs(s.score));
  }, [render, setPhaseBoth, stop]);

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  const start = useCallback(() => {
    stop();
    game.current = newGame(COLS, ROWS);
    setScore(0);
    setPhaseBoth("playing");
    render();
    if (!announced.current) {
      announced.current = true;
      track("easter_egg_found", { name: "snake" });
    }
    timer.current = window.setTimeout(loop, tickMs(0));
  }, [loop, render, setPhaseBoth, stop]);

  const pause = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    stop();
    setPhaseBoth("paused");
  }, [setPhaseBoth, stop]);

  const resume = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    setPhaseBoth("playing");
    timer.current = window.setTimeout(loop, tickMs(game.current.score));
  }, [loop, setPhaseBoth]);

  const steer = useCallback((d: Dir) => {
    game.current = turn(game.current, d);
  }, []);

  useEffect(() => {
    render();
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const d = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (d && phaseRef.current === "playing") {
        e.preventDefault();
        steer(d);
      } else if (
        phaseRef.current === "idle" &&
        !/^(Tab|Escape|Shift|Control|Alt|Meta|F\d+|\/|\?|~|`)$/.test(e.key)
      ) {
        // Idle board: any key starts the game (arrow keys also steer once it is running).
        if (e.target instanceof HTMLElement && e.target.closest("a, input, textarea, select")) return;
        e.preventDefault();
        start();
      } else if (e.key === " " || e.key === "Enter") {
        const p = phaseRef.current;
        // Space/Enter on a focused button already activates it; only act when nothing else will.
        if (e.target instanceof HTMLElement && e.target.closest("button, a, input")) return;
        e.preventDefault();
        if (p === "idle" || p === "over") start();
        else if (p === "playing") pause();
        else resume();
      }
    };
    const onHidden = () => {
      if (document.hidden) pause();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      stop();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [pause, render, resume, start, steer, stop]);

  const onTouchEnd = (e: React.TouchEvent) => {
    const t0 = touch.current;
    const t1 = e.changedTouches[0];
    touch.current = null;
    if (!t0 || !t1) return;
    const dx = t1.clientX - t0.x;
    const dy = t1.clientY - t0.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  };

  const pad =
    "inline-flex size-12 items-center justify-center rounded-sm border border-border bg-surface text-text active:bg-surface-2";

  return (
    <div className="w-full max-w-[360px]">
      <div className="mb-2 flex items-baseline justify-between font-mono text-xs text-muted">
        <span>
          score <span className="text-text">{score}</span>
        </span>
        <span>
          best <span className="text-text">{best}</span>
        </span>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          role="img"
          aria-label={`Snake game board. Score ${score}.`}
          className="block aspect-square w-full touch-none rounded-card border border-border"
          onClick={() => {
            if (phaseRef.current === "idle") start();
          }}
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (t) touch.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={onTouchEnd}
        />
        {phase !== "playing" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-card bg-bg/85 text-center">
            <p className="font-mono text-sm text-text">
              {phase === "idle" ? "Snake · paused" : phase === "paused" ? "Paused" : "Game over"}
            </p>
            <button
              type="button"
              onClick={phase === "paused" ? resume : start}
              className="h-9 rounded-sm border border-accent bg-accent px-4 text-sm font-medium text-bg hover:brightness-110"
            >
              {phase === "idle" ? "Play" : phase === "paused" ? "Resume" : "Play again"}
            </button>
            <p className="px-4 font-mono text-[11px] text-muted">
              {phase === "idle" ? "Press any key or tap to start" : "Arrows or WASD · swipe · Space pauses"}
            </p>
          </div>
        ) : null}
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {phase === "over" ? `Game over. You scored ${score}.` : ""}
      </div>
      <div className="mt-3 grid grid-cols-3 justify-items-center gap-1 sm:hidden" aria-label="Direction pad">
        <span />
        <button type="button" aria-label="Up" className={pad} onClick={() => steer("up")}>
          ↑
        </button>
        <span />
        <button type="button" aria-label="Left" className={pad} onClick={() => steer("left")}>
          ←
        </button>
        <button type="button" aria-label="Down" className={pad} onClick={() => steer("down")}>
          ↓
        </button>
        <button type="button" aria-label="Right" className={pad} onClick={() => steer("right")}>
          →
        </button>
      </div>
    </div>
  );
}
