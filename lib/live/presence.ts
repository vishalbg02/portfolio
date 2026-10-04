import { DEFAULT_PRESENCE, type Presence, type PresenceState, type PresenceView } from "./types";

/**
 * Whether Vishal is "online" for visitors. Rules (all in Bengaluru time, IST):
 *  - /online : online while he has been active (any message or command in Telegram) in the last 20 minutes; after
 *              that he is automatically away
 *  - /away   : away until /online
 *  - /hours 10-22 : online whenever it is between those hours, no matter how recently he was active
 *  - nothing set (auto): online for 20 minutes after he last did anything in Telegram, otherwise away
 */
export const AUTO_AWAY_MS = 20 * 60_000;
const IST_OFFSET_MS = 330 * 60_000;

/** Hour of day (0-23) in Bengaluru. */
export const istHour = (now: number): number => new Date(now + IST_OFFSET_MS).getUTCHours();

/** "10:42 pm" in Bengaluru, deterministic (no ICU). */
export function istClock(now: number): string {
  const d = new Date(now + IST_OFFSET_MS);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? "am" : "pm"}`;
}

/** The day in Bengaluru as YYYY-MM-DD (counters and the digest use it). */
export const istDate = (now: number): string => new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);

/** "10-22", "10:00-22:00" or "22-6" (overnight) → whole hours, or null when it is not a valid range. */
export function parseHours(arg: string): { from: number; to: number } | null {
  const m = /^\s*(\d{1,2})(?::00)?\s*[-–to]+\s*(\d{1,2})(?::00)?\s*$/i.exec(arg);
  if (!m) return null;
  const from = Number(m[1]);
  const to = Number(m[2]);
  if (from > 23 || to > 24 || from === to) return null;
  return { from, to: to === 24 ? 0 : to };
}

export function inHours(h: { from: number; to: number }, now: number): boolean {
  const hour = istHour(now);
  return h.from < h.to ? hour >= h.from && hour < h.to : hour >= h.from || hour < h.to; // overnight wraps midnight
}

export function effectivePresence(p: Presence, now: number): PresenceState {
  if (p.mode === "away") return "away";
  const recentlyActive = p.lastActiveAt !== null && now - p.lastActiveAt < AUTO_AWAY_MS;
  if (p.mode === "online") return recentlyActive ? "online" : "away";
  if (p.hours) return inHours(p.hours, now) ? "online" : "away";
  return recentlyActive ? "online" : "away";
}

export type Command = "online" | "away" | "hours";

/** Applies a Telegram command. Every command also counts as activity. */
export function applyCommand(
  p: Presence,
  cmd: Command,
  arg: string,
  now: number,
): { presence: Presence; ok: boolean } {
  const active = { lastActiveAt: now };
  if (cmd === "online") return { presence: { ...p, ...active, mode: "online" }, ok: true };
  if (cmd === "away") return { presence: { ...p, ...active, mode: "away" }, ok: true };
  if (/^\s*(off|none|clear)\s*$/i.test(arg))
    return { presence: { ...p, ...active, mode: "auto", hours: null }, ok: true };
  const hours = parseHours(arg);
  return hours
    ? { presence: { ...p, ...active, mode: "auto", hours }, ok: true }
    : { presence: { ...p, ...active }, ok: false };
}

/** Any message from him counts as activity (and never changes an explicit /away). */
export const touch = (p: Presence, now: number): Presence => ({ ...p, lastActiveAt: now });

export function presenceView(p: Presence | null, now: number, configured = true): PresenceView {
  const state = effectivePresence(p ?? DEFAULT_PRESENCE, now);
  return {
    configured,
    state,
    time: istClock(now),
    label: state === "online" ? "Online — replies in minutes" : "Away — GRID will take a message",
  };
}
