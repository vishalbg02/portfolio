/**
 * The opening sequence (docs/INTRO.md): GRID wakes up, assembles from contribution squares, flies to its home and
 * hands over to the hero. Server-rendered markup and CSS only (styles/intro.css): it paints with the first frame,
 * runs on the compositor while React hydrates, and removes itself at 1.8 s (0.9 s on phones) whatever happens.
 * It exists only while <html data-intro="play"> (set by the head script, lib/intro/script.ts).
 *
 * Decorative (aria-hidden), never focusable, and never in the way: pointer-events are off, so the hero underneath
 * works from the first frame, and any click, key, wheel or scroll skips it.
 */
const COLS = 12;
const ROWS = 8;
const TILES = COLS * ROWS;

/** Chebyshev distance from the middle, in whole tiles: the ring a tile is on, landscape (12 × 8) and portrait (8 × 12). */
const ring = (i: number, cols: number, rows: number) => {
  const c = i % cols;
  const r = Math.floor(i / cols);
  return Math.floor(Math.max(Math.abs(c - (cols - 1) / 2), Math.abs(r - (rows - 1) / 2)));
};
/** A fixed scatter (0–3), so the dissolve is pixelly rather than a perfect square wave. */
const jitter = (i: number) => (i * 7 + ((i * 13) % 5)) % 4;

const tiles = Array.from(
  { length: TILES },
  (_, i) => `a${ring(i, COLS, ROWS)} b${ring(i, ROWS, COLS)} j${jitter(i)}`,
);

/** GRID's resting face (the same pattern as GridFace's idle state): eyes and a smile. */
const LIT = new Set(["1,1", "3,1", "0,3", "4,3", "1,4", "2,4", "3,4"]);
const EYES = new Set(["1,1", "3,1"]);
const face = Array.from({ length: 25 }, (_, i) => {
  const c = i % 5;
  const r = Math.floor(i / 5);
  const key = `${c},${r}`;
  return {
    cls: [LIT.has(key) ? "on" : "", EYES.has(key) ? "eye" : ""].filter(Boolean).join(" ") || undefined,
    d: Math.max(Math.abs(c - 2), Math.abs(r - 2)),
  };
});

export function IntroOverlay() {
  return (
    <div id="intro" className="intro" aria-hidden="true">
      <div className="intro-tiles">
        {tiles.map((cls, i) => (
          <i key={i} className={cls} />
        ))}
      </div>
      <div className="intro-fly">
        <div className="intro-face">
          {face.map((f, i) => (
            <b key={i} className={f.cls} style={{ ["--fd" as string]: f.d }} />
          ))}
          <span className="intro-dot" />
        </div>
      </div>
      <p className="intro-line">
        <span>GRID online · loading vishal-bg…</span>
      </p>
      <button type="button" tabIndex={-1} className="intro-skip">
        Skip intro <span>· any key</span>
      </button>
    </div>
  );
}
