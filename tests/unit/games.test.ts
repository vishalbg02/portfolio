import { describe, expect, it } from "vitest";
import { newGame, placeFood, same, step, tickMs, turn, type SnakeState } from "@/lib/games/snake";
import * as strike from "@/lib/games/cosmostrike";

const rng = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe("snake", () => {
  it("starts with three segments heading right and food on a free cell", () => {
    const s = newGame(10, 10, rng(0));
    expect(s.snake).toHaveLength(3);
    expect(s.dir).toBe("right");
    expect(s.snake.some((p) => same(p, s.food!))).toBe(false);
  });

  it("moves one cell per step and keeps its length", () => {
    const s = newGame(10, 10, rng(0.99));
    const n = step(s);
    expect(n.snake[0]).toEqual({ x: s.snake[0]!.x + 1, y: s.snake[0]!.y });
    expect(n.snake).toHaveLength(3);
  });

  it("ignores reversals and repeats, keeps at most two queued turns", () => {
    let s = newGame(10, 10);
    s = turn(s, "left"); // reversal of "right"
    s = turn(s, "right"); // repeat
    expect(s.queue).toEqual([]);
    s = turn(s, "up");
    s = turn(s, "left");
    s = turn(s, "down"); // queue full
    expect(s.queue).toEqual(["up", "left"]);
    expect(step(s).dir).toBe("up");
  });

  it("dies on a wall", () => {
    let s = newGame(5, 5);
    for (let i = 0; i < 5 && s.alive; i++) s = step(s);
    expect(s.alive).toBe(false);
    expect(step(s)).toBe(s); // dead snakes stay put
  });

  it("grows and scores when it eats, and never spawns food on itself", () => {
    const base = newGame(10, 10, rng(0.5));
    const head = base.snake[0]!;
    const s: SnakeState = { ...base, food: { x: head.x + 1, y: head.y } };
    const n = step(s, rng(0));
    expect(n.score).toBe(1);
    expect(n.snake).toHaveLength(4);
    expect(n.snake.some((p) => same(p, n.food!))).toBe(false);
  });

  it("can follow its own tail but dies biting its body", () => {
    const loop: SnakeState = {
      cols: 6,
      rows: 6,
      snake: [
        { x: 2, y: 2 },
        { x: 2, y: 3 },
        { x: 3, y: 3 },
        { x: 3, y: 2 },
      ],
      dir: "left",
      queue: [],
      food: { x: 0, y: 0 },
      score: 0,
      alive: true,
      won: false,
    };
    // moving "down" from (2,2) into (2,3) hits the body
    expect(step({ ...loop, dir: "down" }).alive).toBe(false);
    // the tail cell (3,2) is vacated this tick, so a head that arrives there survives
    expect(step({ ...loop, snake: [{ x: 4, y: 2 }, ...loop.snake.slice(1)], dir: "left" }).alive).toBe(true);
  });

  it("wins when the board is full", () => {
    const s: SnakeState = {
      cols: 2,
      rows: 2,
      snake: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
      dir: "right",
      queue: [],
      food: { x: 1, y: 0 },
      score: 0,
      alive: true,
      won: false,
    };
    const n = step(s);
    expect(n.won).toBe(true);
    expect(n.alive).toBe(false);
    expect(placeFood(n.snake, 2, 2)).toBeNull();
  });

  it("speeds up with score but never beyond 60 ms", () => {
    expect(tickMs(0)).toBe(140);
    expect(tickMs(5)).toBeLessThan(tickMs(0));
    expect(tickMs(500)).toBe(60);
  });
});

const idle: strike.Input = { left: false, right: false, fire: false, targetX: null };

describe("cosmostrike", () => {
  it("moves the ship and keeps it on screen", () => {
    let s = strike.newGame();
    for (let i = 0; i < 100; i++) s = strike.update(s, { ...idle, left: true }, 16, rng(0.5));
    expect(s.shipX).toBe(strike.SHIP_HALF);
    for (let i = 0; i < 200; i++) s = strike.update(s, { ...idle, right: true }, 16, rng(0.5));
    expect(s.shipX).toBe(strike.W - strike.SHIP_HALF);
  });

  it("fires at a limited rate", () => {
    let s = strike.newGame();
    s = strike.update(s, { ...idle, fire: true }, 16, rng(0.5));
    expect(s.bullets).toHaveLength(1);
    s = strike.update(s, { ...idle, fire: true }, 16, rng(0.5));
    expect(s.bullets).toHaveLength(1); // still cooling down
  });

  it("destroys an enemy a bullet hits and scores for it", () => {
    const base = strike.newGame();
    const s = {
      ...base,
      spawnIn: 99999,
      bullets: [{ x: 100, y: 200 }],
      enemies: [{ x: 100, y: 190, vy: 0, r: 14 }],
    };
    const n = strike.update(s, idle, 16, rng(0.5));
    expect(n.enemies).toHaveLength(0);
    expect(n.bullets).toHaveLength(0);
    expect(n.score).toBe(10);
  });

  it("loses a life when an enemy reaches the bottom, and ends at zero lives", () => {
    const base = strike.newGame();
    let s = { ...base, spawnIn: 99999, lives: 1, enemies: [{ x: 20, y: strike.H + 40, vy: 50, r: 14 }] };
    s = strike.update(s, idle, 16, rng(0.5));
    expect(s.lives).toBe(0);
    expect(s.over).toBe(true);
    expect(strike.update(s, idle, 16)).toBe(s);
  });

  it("gives brief invulnerability after a collision", () => {
    const base = strike.newGame();
    const s = {
      ...base,
      spawnIn: 99999,
      enemies: [
        { x: base.shipX, y: strike.SHIP_Y, vy: 0, r: 14 },
        { x: base.shipX, y: strike.SHIP_Y, vy: 0, r: 14 },
      ],
    };
    const n = strike.update(s, idle, 16, rng(0.5));
    expect(n.lives).toBe(2); // only one life lost, the second enemy is absorbed by invulnerability
    expect(n.invuln).toBeGreaterThan(0);
  });

  it("spawns enemies over time and spawns faster later, within a floor", () => {
    let s = strike.newGame();
    for (let i = 0; i < 80; i++) s = strike.update({ ...s, lives: 99 }, idle, 16, rng(0.3, 0.6));
    expect(s.enemies.length + (99 - s.lives)).toBeGreaterThan(0);
    expect(strike.spawnEvery(0)).toBeGreaterThan(strike.spawnEvery(10_000));
    expect(strike.spawnEvery(1e9)).toBe(320);
  });

  it("caps dt so a backgrounded tab can't teleport everything", () => {
    const s = { ...strike.newGame(), enemies: [{ x: 50, y: 0, vy: 100, r: 14 }], spawnIn: 99999 };
    const n = strike.update(s, idle, 5000, rng(0.5));
    expect(n.enemies[0]!.y).toBeCloseTo(5, 5); // 100 px/s * 0.05 s
  });
});

import { KONAMI, konamiProgress } from "@/lib/delight";

describe("konami matcher", () => {
  const feed = (keys: string[]) => keys.reduce((p, k) => konamiProgress(p, k), 0);
  it("unlocks on the full sequence (case-insensitive letters)", () => {
    expect(feed([...KONAMI])).toBe(10);
    expect(
      feed([
        "ArrowUp",
        "ArrowUp",
        "ArrowDown",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "ArrowLeft",
        "ArrowRight",
        "B",
        "A",
      ]),
    ).toBe(10);
  });
  it("resets on a wrong key, but a fresh start key begins a new attempt", () => {
    expect(feed(["ArrowUp", "ArrowUp", "x"])).toBe(0);
    // a stray extra "up" restarts the attempt instead of losing the sequence entirely
    expect(
      feed([
        "ArrowUp",
        "ArrowUp",
        "ArrowUp",
        "ArrowDown",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "ArrowLeft",
        "ArrowRight",
        "b",
        "a",
      ]),
    ).toBe(10);
  });
});
