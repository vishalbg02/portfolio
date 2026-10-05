import type { CSSProperties } from "react";
import { ROWS, layoutText } from "@/lib/pixel/text";

/** Only the two brightest levels, so the letters stand out from the dark squares behind them. */
const level = (col: number, row: number) => 3 + ((col * 7 + row * 3) % 2);

/**
 * A line of text in contribution squares (the pixel font in lib/pixel/text.ts), drawn at the width of its container:
 * the viewBox is the text's own grid, so the squares scale to fit and nothing can be clipped. Decorative.
 *
 * Compact on purpose (it is in every page's footer): one path per brightness level instead of an element per square,
 * with the corners rounded by a stroke of the same colour.
 *
 * - `base`: every square of the grid is drawn dark underneath (the LET'S BUILD banner, the footer wordmark).
 * - `outline`: the letters' squares carry a hairline, so before a reveal fills them they read as empty squares
 *   (the chapter numerals).
 *
 * The lit squares are one group (`.px-lit`, with its column count as `--cols`), so a surrounding Reveal lights them left
 * to right a column at a time (styles/system.css). The markup is the final state: no JS or reduced motion shows it lit.
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
  // rounded corners: each square is inset by r/2 and stroked r wide with round joins
  const r = outline ? 0 : Math.max(1, cell / 5);
  const sq = (col: number, row: number) => {
    const s = cell - r;
    return `M${col * pitch + r / 2} ${row * pitch + r / 2}h${s}v${s}h-${s}z`;
  };
  const lit: Record<number, string> = { 3: "", 4: "" };
  for (const c of cells) lit[level(c.col, c.row)] += sq(c.col, c.row);
  const grid = base
    ? Array.from({ length: cols * ROWS }, (_, i) => sq(Math.floor(i / ROWS), i % ROWS)).join("")
    : "";
  const round = r ? { strokeWidth: r, strokeLinejoin: "round" as const } : {};
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${cols * pitch - gap} ${ROWS * pitch - gap}`}
      className={className}
      data-px-outline={outline ? "" : undefined}
    >
      {grid ? <path d={grid} fill="var(--grid-0)" stroke="var(--grid-0)" {...round} /> : null}
      {outline ? <path d={lit[3] + lit[4]} fill="none" stroke="var(--grid-2)" strokeWidth={0.6} /> : null}
      <g className="px-lit" style={{ "--cols": cols } as CSSProperties}>
        {[3, 4].map((l) =>
          lit[l] ? (
            <path
              key={l}
              className="px-on"
              data-l={l}
              d={lit[l]}
              stroke={outline ? "var(--grid-2)" : `var(--grid-${l})`}
              strokeWidth={outline ? 0.6 : r}
              strokeLinejoin="round"
            />
          ) : null,
        )}
      </g>
    </svg>
  );
}
