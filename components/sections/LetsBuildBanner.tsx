import { Reveal } from "@/components/ui/Reveal";
import { ROWS, layoutText } from "@/lib/pixel/text";

const CELL = 10;
const GAP = 3;
const PITCH = CELL + GAP;

/** Only the two brightest levels, so the letters stand out from the dark squares behind them. */
const level = (col: number, row: number) => 3 + ((col * 7 + row * 3) % 2);

/**
 * One line of text in contribution squares, drawn at the width of its container: the viewBox is the
 * text's own grid, so the squares scale to fit and nothing can ever be clipped. The unlit squares are one
 * path (a handful of elements instead of hundreds), without outlines so they stay quiet behind the letters.
 */
function PixelLine({ text, className }: { text: string; className: string }) {
  const { cells, cols } = layoutText(text);
  const lit = new Set(cells.map((c) => `${c.col},${c.row}`));
  const base = Array.from({ length: cols * ROWS }, (_, i) => {
    const col = Math.floor(i / ROWS);
    const row = i % ROWS;
    return lit.has(`${col},${row}`) ? "" : `M${col * PITCH} ${row * PITCH}h${CELL}v${CELL}h-${CELL}z`;
  }).join("");
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${cols * PITCH - GAP} ${ROWS * PITCH - GAP}`} className={className}>
      <path d={base} fill="var(--grid-0)" />
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
  );
}

/**
 * LET'S BUILD spelled in contribution squares, lighting up left to right when it scrolls into view
 * (one-shot; final state in the markup, so no JS or reduced motion shows it complete). Decorative.
 * From 640 px up it is the full phrase; below that it is just BUILD, so every square stays readable
 * on a phone (a 58-column phrase in 358 px would be 6 px squares).
 */
export function LetsBuildBanner() {
  return (
    <Reveal threshold={0.4} className="px-banner mt-8 mb-2">
      <PixelLine text="LET'S BUILD" className="hidden h-auto w-full sm:block" />
      <PixelLine text="BUILD" className="block h-auto w-full sm:hidden" />
    </Reveal>
  );
}
