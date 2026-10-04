/** Bengaluru is UTC+5:30 all year (India has no daylight saving). */
export const IST_OFFSET_MS = 330 * 60_000;

/** The hour (0 to 23) in Bengaluru at this instant. */
export const istHourOf = (nowMs: number): number => new Date(nowMs + IST_OFFSET_MS).getUTCHours();

/** From midnight until 7 in the morning in Bengaluru, Vishal is probably asleep and GRID is on duty. */
export const isNight = (nowMs: number): boolean => istHourOf(nowMs) < 7;

export const NIGHT_STATUS = "Vishal's probably asleep — GRID is on duty 🌙";
