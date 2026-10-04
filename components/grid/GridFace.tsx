import { cn } from "@/lib/utils/cn";

export type FaceState = "idle" | "listening" | "thinking" | "speaking" | "acting";

/** Which squares (column,row) are lit in each state, so reduced motion still shows the state as a still pattern. */
const LIT: Record<FaceState, string[]> = {
  idle: ["1,1", "3,1", "0,3", "4,3", "1,4", "2,4", "3,4"], // eyes and a smile
  listening: ["2,0", "1,1", "3,1", "0,3", "4,3", "1,4", "2,4", "3,4"], // + an antenna
  thinking: ["1,0", "3,0", "1,3", "2,3", "3,3"], // eyes up, a flat mouth
  speaking: ["1,1", "3,1", "1,3", "2,3", "3,3", "1,4", "3,4"], // an open mouth
  acting: ["1,1", "3,1", "2,3"], // eyes and the dot that travels
};
const STATES = Object.keys(LIT) as FaceState[];

/** The squares in this state's pattern as "idle thinking …" per cell, computed once. */
const cells = Array.from({ length: 25 }, (_, i) => {
  const c = i % 5;
  const r = Math.floor(i / 5);
  return { c, r, on: STATES.filter((s) => LIT[s].includes(`${c},${r}`)).join(" ") };
});

/**
 * GRID's face: a 5 × 5 grid of flat contribution squares. CSS (styles/grid.css) lights the squares for the
 * current state and animates them: idle breathes, listening is attentive, thinking is a wave, speaking is an
 * equaliser, acting is one square travelling the edge. Pure markup (no JS), so it works in a server component.
 */
export function GridFace({
  state = "idle",
  size = 28,
  className,
  label,
  still = false,
}: {
  state?: FaceState;
  size?: number;
  className?: string;
  /** No animation, only the pattern: for the many small faces in a conversation, so only the live one moves. */
  still?: boolean;
  /** Spoken label; omit when the face sits beside text that says it already (then it is decorative). */
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 29 29"
      width={size}
      height={size}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-state={state}
      data-still={still ? "" : undefined}
      className={cn("gf shrink-0", className)}
    >
      {cells.map(({ c, r, on }) => (
        <rect
          key={`${c}-${r}`}
          x={c * 6}
          y={r * 6}
          width="5"
          height="5"
          rx="1.2"
          data-on={on || undefined}
          data-row={r}
          style={{ ["--d" as string]: c + r, ["--c" as string]: c }}
        />
      ))}
      <rect className="trav" width="5" height="5" rx="1.2" />
    </svg>
  );
}
