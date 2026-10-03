/**
 * CosmoStrike: a tiny vertical shooter. Pure, deterministic game logic (the caller supplies dt and an
 * RNG), so it can be unit-tested. A homage to the space game Vishal's team built for Gamecraft, not
 * the original.
 */
export const W = 360;
export const H = 520;
export const SHIP_Y = H - 48;
export const SHIP_HALF = 14;

export type Enemy = { x: number; y: number; vy: number; r: number };
export type Bullet = { x: number; y: number };
export type StrikeState = {
  shipX: number;
  bullets: Bullet[];
  enemies: Enemy[];
  score: number;
  lives: number;
  time: number;
  cooldown: number;
  spawnIn: number;
  /** ms of invulnerability after a hit */
  invuln: number;
  over: boolean;
};
export type Input = { left: boolean; right: boolean; fire: boolean; targetX: number | null };
export type Rng = () => number;

export const newGame = (): StrikeState => ({
  shipX: W / 2,
  bullets: [],
  enemies: [],
  score: 0,
  lives: 3,
  time: 0,
  cooldown: 0,
  spawnIn: 600,
  invuln: 0,
  over: false,
});

const SHIP_SPEED = 280; // px/s
const BULLET_SPEED = 520;
const FIRE_EVERY = 220; // ms
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const spawnEvery = (time: number) => Math.max(320, 900 - time / 30);

export function update(s: StrikeState, input: Input, dtMs: number, rng: Rng = Math.random): StrikeState {
  if (s.over) return s;
  const dt = Math.min(dtMs, 50);
  const sec = dt / 1000;

  // move
  let shipX = s.shipX;
  if (input.targetX !== null) {
    const d = input.targetX - shipX;
    shipX += clamp(d, -SHIP_SPEED * 1.6 * sec, SHIP_SPEED * 1.6 * sec);
  } else {
    shipX += ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * SHIP_SPEED * sec;
  }
  shipX = clamp(shipX, SHIP_HALF, W - SHIP_HALF);

  // fire
  let cooldown = Math.max(0, s.cooldown - dt);
  let bullets = s.bullets.map((b) => ({ x: b.x, y: b.y - BULLET_SPEED * sec })).filter((b) => b.y > -8);
  if (input.fire && cooldown === 0) {
    bullets = [...bullets, { x: shipX, y: SHIP_Y - 16 }];
    cooldown = FIRE_EVERY;
  }

  // enemies
  let spawnIn = s.spawnIn - dt;
  let enemies = s.enemies.map((e) => ({ ...e, y: e.y + e.vy * sec }));
  if (spawnIn <= 0) {
    const r = 12 + Math.floor(rng() * 8);
    enemies = [...enemies, { x: r + rng() * (W - 2 * r), y: -r, vy: 60 + rng() * 40 + s.time / 400, r }];
    spawnIn = spawnEvery(s.time);
  }

  // bullets vs enemies
  let score = s.score;
  const dead = new Set<number>();
  const spent = new Set<number>();
  bullets.forEach((b, bi) => {
    enemies.forEach((e, ei) => {
      if (dead.has(ei) || spent.has(bi)) return;
      if (Math.hypot(b.x - e.x, b.y - e.y) <= e.r + 3) {
        dead.add(ei);
        spent.add(bi);
        score += 10;
      }
    });
  });
  bullets = bullets.filter((_, i) => !spent.has(i));

  // enemies vs ship / floor
  let lives = s.lives;
  let invuln = Math.max(0, s.invuln - dt);
  const survivors: Enemy[] = [];
  enemies.forEach((e, i) => {
    if (dead.has(i)) return;
    const hitsShip = invuln === 0 && Math.hypot(e.x - shipX, e.y - SHIP_Y) <= e.r + SHIP_HALF - 2;
    if (hitsShip) {
      lives -= 1;
      invuln = 1200;
      return;
    }
    if (e.y - e.r > H) {
      lives -= 1;
      return;
    }
    survivors.push(e);
  });

  return {
    shipX,
    bullets,
    enemies: survivors,
    score,
    lives: Math.max(0, lives),
    time: s.time + dt,
    cooldown,
    spawnIn,
    invuln,
    over: lives <= 0,
  };
}
