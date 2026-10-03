import { VBG_COLS, VBG_ROWS, buildVbgGrid } from "@/lib/hero/vbg";

const CELL = 10;
const GAP = 3;
const PITCH = CELL + GAP;
const WAVE_STEP_MS = 110; // delay per column → a slow wave sweeping left to right

const WIDTH = VBG_COLS * PITCH - GAP;
const HEIGHT = VBG_ROWS * PITCH - GAP;

/**
 * Pixel contribution grid spelling "VBG". Pure SVG, server-rendered (zero JS);
 * the wave is a CSS animation, frozen by the global prefers-reduced-motion rule.
 */
export function VbgGrid() {
  const cells = buildVbgGrid();
  const rect = (c: (typeof cells)[number], className: string, delay?: number) => (
    <rect
      key={`${c.x}-${c.y}`}
      x={c.x * PITCH}
      y={c.y * PITCH}
      width={CELL}
      height={CELL}
      rx={2}
      className={className}
      style={delay === undefined ? undefined : { animationDelay: `${delay}ms` }}
    />
  );

  return (
    <svg
      role="img"
      aria-label="A pixel contribution grid spelling VBG"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="mx-auto h-auto w-full max-w-[460px]"
    >
      <g className="fill-grid-0">{cells.filter((c) => !c.letter && c.level === 0).map((c) => rect(c, ""))}</g>
      <g className="fill-grid-1">{cells.filter((c) => !c.letter && c.level === 1).map((c) => rect(c, ""))}</g>
      <g>{cells.filter((c) => c.letter).map((c) => rect(c, "vbg-letter", c.x * WAVE_STEP_MS))}</g>
    </svg>
  );
}
