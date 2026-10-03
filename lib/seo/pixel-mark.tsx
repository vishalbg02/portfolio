/**
 * The "VBG" pixel mark (same 13×13 grid as app/icon.svg), drawn with plain divs so it can be
 * rendered by next/og for PWA and Apple icons. Flat colors only.
 */
const CELLS: Array<[number, number]> = [
  [1, 4],
  [3, 4],
  [1, 5],
  [3, 5],
  [1, 6],
  [3, 6],
  [1, 7],
  [3, 7],
  [2, 8],
  [5, 4],
  [6, 4],
  [5, 5],
  [7, 5],
  [5, 6],
  [6, 6],
  [5, 7],
  [7, 7],
  [5, 8],
  [6, 8],
  [10, 4],
  [11, 4],
  [9, 5],
  [9, 6],
  [11, 6],
  [9, 7],
  [11, 7],
  [10, 8],
  [11, 8],
];

export function PixelMark({ size, padding = 0 }: { size: number; padding?: number }) {
  const inner = size - padding * 2;
  const cell = inner / 13;
  return (
    <div style={{ display: "flex", width: size, height: size, background: "#0d1117", position: "relative" }}>
      {CELLS.map(([x, y]) => (
        <div
          key={`${x}-${y}`}
          style={{
            position: "absolute",
            left: padding + x * cell,
            top: padding + y * cell,
            width: cell,
            height: cell,
            background: "#39d353",
            display: "flex",
          }}
        />
      ))}
    </div>
  );
}
