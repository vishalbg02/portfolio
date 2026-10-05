import type { CSSProperties } from "react";
import { ROWS, layoutText } from "@/lib/pixel/text";

/** Only the two brightest levels, so the letters stand out from the dark squares behind them. */
const level = (col: number, row: number) => 3 + ((col * 7 + row * 3) % 2);

/**
 * A line of text in contribution squares (the pixel font in lib/pixel/text.ts), drawn at the width of its container:
 * the viewBox is the text's own grid, so the squares scale to fit and nothing can be clipped. Decorative.
 *
 * - `base`: the unlit squares are drawn too, as one quiet path (the LET'S BUILD banner, the footer wordmark).
 * - `outline`: lit squares carry a hairline, so before a reveal fills them they read as empty squares (the chapter
 *   numerals).
 *
 * Lit squares are `.px-on` with a level and their column (`--col`), so a surrounding Reveal can light them left to
 * right (styles/case.css). The markup is the final state: no JS or reduced motion shows it complete.
 */
export function PixelText({
  text,
  cell = 10,
  gap = 3,
  base = true,
  outline = false,
  className,
}: {
  text: string;
  cell?: number;
  gap?: number;
  base?: boolean;
  outline?: boolean;
  className?: string;
}) {
  const pitch = cell + gap;
  const { cells, cols } = layoutText(text);
  const lit = new Set(cells.map((c) => `${c.col},${c.row}`));
  const r = Math.max(1, cell / 5);
  const unlit = base
    ? Array.from({ length: cols * ROWS }, (_, i) => {
        const col = Math.floor(i / ROWS);
        const row = i % ROWS;
        return lit.has(`${col},${row}`) ? "" : `M${col * pitch} ${row * pitch}h${cell}v${cell}h-${cell}z`;
      }).join("")
    : "";
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${cols * pitch - gap} ${ROWS * pitch - gap}`}
      className={className}
      data-px-outline={outline ? "" : undefined}
    >
      {unlit ? <path d={unlit} fill="var(--grid-0)" /> : null}
      {cells.map((c) => (
        <rect
          key={`${c.col}-${c.row}`}
          className="px-on"
          data-l={level(c.col, c.row)}
          style={{ "--col": c.col } as CSSProperties}
          x={c.col * pitch}
          y={c.row * pitch}
          width={cell}
          height={cell}
          rx={r}
        />
      ))}
    </svg>
  );
}
