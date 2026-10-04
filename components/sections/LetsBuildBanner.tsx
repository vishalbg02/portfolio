import { Reveal } from "@/components/ui/Reveal";
import { ROWS, layoutText } from "@/lib/pixel/text";

const CELL = 10;
const GAP = 3;
const PITCH = CELL + GAP;
const { cells, cols } = layoutText("LET'S BUILD");
const lit = new Set(cells.map((c) => `${c.col},${c.row}`));

/** The unlit grid as one path (contribution-graph squares), so the banner is ~150 elements, not 450. */
const base = Array.from({ length: cols * ROWS }, (_, i) => {
  const col = Math.floor(i / ROWS);
  const row = i % ROWS;
  return lit.has(`${col},${row}`) ? "" : `M${col * PITCH} ${row * PITCH}h${CELL}v${CELL}h-${CELL}z`;
}).join("");

/** Level 2–4 greens, deterministic from the position so it looks like real activity, not a flat fill. */
const level = (col: number, row: number) => 2 + ((col * 7 + row * 3) % 3);

/**
 * LET'S BUILD spelled in contribution squares, lighting up left to right when it scrolls into view
 * (one-shot; final state in the markup, so no JS or reduced motion shows it complete). Decorative.
 */
export function LetsBuildBanner() {
  return (
    <Reveal threshold={0.4} className="px-banner mt-8 mb-2">
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${cols * PITCH - GAP} ${ROWS * PITCH - GAP}`}
        className="block h-auto w-full"
      >
        <path d={base} fill="var(--grid-0)" stroke="var(--border)" strokeWidth={0.5} />
        {cells.map((c) => (
          <rect
            key={`${c.col}-${c.row}`}
            className="px-on"
            data-l={level(c.col, c.row)}
            style={{ "--col": c.col } as React.CSSProperties}
            x={c.col * PITCH}
            y={c.row * PITCH}
            width={CELL}
            height={CELL}
            rx={2}
          />
        ))}
      </svg>
    </Reveal>
  );
}
