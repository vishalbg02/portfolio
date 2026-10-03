"use client";

import { Dialog } from "radix-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  H,
  SHIP_HALF,
  SHIP_Y,
  W,
  newGame,
  update,
  type Input,
  type StrikeState,
} from "@/lib/games/cosmostrike";

const BEST_KEY = "cosmostrike-best";
const C = {
  bg: "#0d1117",
  star: "#30363d",
  ship: "#3fb950",
  bullet: "#e6edf3",
  enemy: "#f85149",
  hud: "#8b949e",
};

type Phase = "ready" | "playing" | "paused" | "over";

const readBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};

// Fixed star field so the background is stable between frames.
const STARS = Array.from({ length: 40 }, (_, i) => ({
  x: (i * 97) % W,
  y: (i * 211) % H,
  s: 0.6 + ((i * 7) % 3) * 0.4,
}));

function draw(ctx: CanvasRenderingContext2D, s: StrikeState) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.star;
  const drift = (s.time / 40) % H;
  for (const st of STARS) ctx.fillRect(st.x, (st.y + drift * st.s) % H, st.s, st.s);

  ctx.fillStyle = C.bullet;
  for (const b of s.bullets) ctx.fillRect(b.x - 1.5, b.y - 7, 3, 12);

  ctx.fillStyle = C.enemy;
  for (const e of s.enemies) {
    ctx.beginPath();
    ctx.moveTo(e.x, e.y + e.r);
    ctx.lineTo(e.x - e.r, e.y - e.r * 0.7);
    ctx.lineTo(e.x + e.r, e.y - e.r * 0.7);
    ctx.closePath();
    ctx.fill();
  }

  // ship blinks while invulnerable
  if (s.invuln === 0 || Math.floor(s.time / 90) % 2 === 0) {
    ctx.fillStyle = C.ship;
    ctx.beginPath();
    ctx.moveTo(s.shipX, SHIP_Y - 16);
    ctx.lineTo(s.shipX - SHIP_HALF, SHIP_Y + 12);
    ctx.lineTo(s.shipX + SHIP_HALF, SHIP_Y + 12);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = C.hud;
  ctx.font = "12px ui-monospace, monospace";
  ctx.fillText(`score ${s.score}`, 10, 18);
  ctx.textAlign = "right";
  ctx.fillText(`lives ${s.lives}`, W - 10, 18);
  ctx.textAlign = "left";
}

function Board() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef<StrikeState>(newGame());
  const input = useRef<Input>({ left: false, right: false, fire: false, targetX: null });
  const raf = useRef<number | null>(null);
  const last = useRef(0);
  const phaseRef = useRef<Phase>("ready");
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  // Mounted only while the dialog is open, in the browser, so this initializer is safe.
  const [best, setBest] = useState(readBest);
  const frameRef = useRef<(now: number) => void>(() => {});

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const stopLoop = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  }, []);

  const frame = useCallback(
    (now: number) => {
      const dt = last.current ? now - last.current : 16;
      last.current = now;
      state.current = update(state.current, input.current, dt);
      const s = state.current;
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) draw(ctx, s);
      setScore(s.score);
      if (s.over) {
        raf.current = null;
        setPhaseBoth("over");
        setBest((b) => {
          const nb = Math.max(b, s.score);
          try {
            localStorage.setItem(BEST_KEY, String(nb));
          } catch {
            /* best score simply isn't remembered */
          }
          return nb;
        });
        return;
      }
      raf.current = requestAnimationFrame((t) => frameRef.current(t));
    },
    [setPhaseBoth],
  );

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  const begin = useCallback(
    (fresh: boolean) => {
      if (fresh) {
        state.current = newGame();
        setScore(0);
      }
      last.current = 0;
      setPhaseBoth("playing");
      stopLoop();
      raf.current = requestAnimationFrame(frame);
    },
    [frame, setPhaseBoth, stopLoop],
  );

  const pause = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    stopLoop();
    setPhaseBoth("paused");
  }, [setPhaseBoth, stopLoop]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) draw(ctx, state.current);

    const set = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === "ArrowLeft" || k === "a") input.current.left = down;
      else if (k === "ArrowRight" || k === "d") input.current.right = down;
      else if (k === " " || k === "ArrowUp" || k === "w") input.current.fire = down;
      else return false;
      return true;
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " " && e.target instanceof HTMLElement && e.target.closest("button")) return;
      if (set(e, true)) {
        e.preventDefault();
        if (phaseRef.current === "ready" || phaseRef.current === "over") begin(true);
        else if (phaseRef.current === "paused") begin(false);
      } else if (e.key.toLowerCase() === "p") {
        if (phaseRef.current === "playing") pause();
        else if (phaseRef.current === "paused") begin(false);
      }
    };
    const onUp = (e: KeyboardEvent) => void set(e, false);
    const onHidden = () => document.hidden && pause();

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      stopLoop();
      input.current = { left: false, right: false, fire: false, targetX: null };
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [begin, pause, stopLoop]);

  const pointer = (e: React.PointerEvent<HTMLCanvasElement>, down: boolean) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (down) {
      input.current.targetX = ((e.clientX - rect.left) / rect.width) * W;
      input.current.fire = true; // touch and mouse auto-fire while held
      if (phaseRef.current === "ready" || phaseRef.current === "over") begin(true);
      else if (phaseRef.current === "paused") begin(false);
    } else {
      input.current.targetX = null;
      input.current.fire = false;
    }
  };

  return (
    <>
      <div className="relative w-full max-w-[360px]">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          role="img"
          aria-label={`CosmoStrike board. Score ${score}.`}
          className="block aspect-[360/520] max-h-[calc(100dvh-140px)] w-full touch-none rounded-card border border-border"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pointer(e, true);
          }}
          onPointerMove={(e) => {
            if (e.buttons || e.pointerType === "touch") {
              const rect = e.currentTarget.getBoundingClientRect();
              input.current.targetX = ((e.clientX - rect.left) / rect.width) * W;
            }
          }}
          onPointerUp={(e) => pointer(e, false)}
          onPointerCancel={(e) => pointer(e, false)}
        />
        {phase !== "playing" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-card bg-bg/85 text-center">
            <p className="font-mono text-sm text-text">
              {phase === "ready" ? "CosmoStrike" : phase === "paused" ? "Paused" : `Game over · ${score}`}
            </p>
            <button
              type="button"
              onClick={() => begin(phase !== "paused")}
              className="h-9 rounded-sm border border-accent bg-accent px-4 text-sm font-medium text-bg hover:brightness-110"
            >
              {phase === "ready" ? "Start" : phase === "paused" ? "Resume" : "Play again"}
            </button>
            <p className="px-4 font-mono text-[11px] text-muted">
              ← → or A/D move · Space fires · P pauses · touch: drag
            </p>
            <p className="font-mono text-[11px] text-muted">best {best}</p>
          </div>
        ) : null}
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {phase === "over" ? `Game over. You scored ${score}.` : ""}
      </div>
    </>
  );
}

/** CosmoStrike: a tiny homage to the space game from Gamecraft. Esc quits, hiding the tab pauses. */
export default function CosmoStrikeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-bg/90" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-0 z-[71] flex flex-col items-center justify-center gap-3 p-3 focus:outline-none"
        >
          <div className="flex w-full max-w-[360px] items-center justify-between">
            <Dialog.Title className="font-mono text-xs tracking-[0.12em] text-muted uppercase">
              <span className="mr-2 text-accent">▲</span>CosmoStrike
            </Dialog.Title>
            <Dialog.Close className="h-8 rounded-sm border border-border px-3 font-mono text-xs text-muted hover:border-border-2 hover:text-text">
              Esc · quit
            </Dialog.Close>
          </div>
          <div className="relative w-full max-w-[360px]">
            <Board />
          </div>
          <p className="font-mono text-[11px] text-muted">A tiny homage to the space game from Gamecraft.</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
