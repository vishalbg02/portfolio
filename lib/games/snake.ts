/**
 * Snake: pure, immutable game logic (no DOM, no timers) so it can be unit-tested.
 * The board does not wrap: hitting a wall or yourself ends the game.
 */
export type Dir = "up" | "down" | "left" | "right";
export type Point = { x: number; y: number };
export type SnakeState = {
  cols: number;
  rows: number;
  /** head first */
  snake: Point[];
  dir: Dir;
  /** turns waiting to be applied, one per tick (max 2, so quick double-taps don't get lost) */
  queue: Dir[];
  food: Point | null;
  score: number;
  alive: boolean;
  won: boolean;
};

export type Rng = () => number;

const VECTORS: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

export const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

export function placeFood(snake: Point[], cols: number, rows: number, rng: Rng = Math.random): Point | null {
  const free: Point[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!snake.some((p) => p.x === x && p.y === y)) free.push({ x, y });
    }
  }
  if (free.length === 0) return null;
  return free[Math.min(free.length - 1, Math.floor(rng() * free.length))]!;
}

export function newGame(cols = 20, rows = 20, rng: Rng = Math.random): SnakeState {
  const y = Math.floor(rows / 2);
  const x = Math.floor(cols / 2);
  const snake = [
    { x, y },
    { x: x - 1, y },
    { x: x - 2, y },
  ];
  return {
    cols,
    rows,
    snake,
    dir: "right",
    queue: [],
    food: placeFood(snake, cols, rows, rng),
    score: 0,
    alive: true,
    won: false,
  };
}

/** Queue a turn. Reversals and repeats (relative to the last queued direction) are ignored. */
export function turn(s: SnakeState, d: Dir): SnakeState {
  if (!s.alive || s.queue.length >= 2) return s;
  const last = s.queue[s.queue.length - 1] ?? s.dir;
  if (d === last || d === OPPOSITE[last]) return s;
  return { ...s, queue: [...s.queue, d] };
}

export function step(s: SnakeState, rng: Rng = Math.random): SnakeState {
  if (!s.alive) return s;
  const [next, ...rest] = s.queue;
  const dir = next ?? s.dir;
  const v = VECTORS[dir];
  const head = { x: s.snake[0]!.x + v.x, y: s.snake[0]!.y + v.y };

  const hitsWall = head.x < 0 || head.y < 0 || head.x >= s.cols || head.y >= s.rows;
  const eats = s.food !== null && same(head, s.food);
  // the tail cell is free this tick unless the snake is growing
  const body = eats ? s.snake : s.snake.slice(0, -1);
  if (hitsWall || body.some((p) => same(p, head))) return { ...s, dir, queue: rest, alive: false };

  const snake = [head, ...(eats ? s.snake : s.snake.slice(0, -1))];
  const food = eats ? placeFood(snake, s.cols, s.rows, rng) : s.food;
  return {
    ...s,
    snake,
    dir,
    queue: rest,
    food,
    score: s.score + (eats ? 1 : 0),
    alive: !(eats && food === null),
    won: eats && food === null,
  };
}

/** Milliseconds per tick: starts relaxed and speeds up, never faster than 60 ms. */
export const tickMs = (score: number) => Math.max(60, 140 - score * 4);
