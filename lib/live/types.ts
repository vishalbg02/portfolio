/**
 * Live chat: a visitor talks to Vishal; he answers from Telegram. Shared by server and browser (no server-only code).
 */
export const LIVE = {
  name: { min: 2, max: 80 },
  org: { max: 120 },
  email: { max: 200 },
  message: { min: 1, max: 1500 },
  /** More links than this in one message is refused. */
  links: 2,
  /** Threads are deleted after this long. */
  ttlSec: 30 * 86_400,
  /** Abuse limits: conversations per client per day, messages per conversation per hour, conversations per day overall. */
  convsPerDay: 5,
  msgsPerHour: 30,
  globalConvsPerDay: 100,
  /** After this long without a reply the visitor is asked for an email address. */
  replyWaitMs: 120_000,
  /** The visitor counts as "on the site" this long after their last poll (so no email is sent for a reply they just saw). */
  presentMs: 60_000,
  /** At most this many reply emails per conversation per day. */
  emailsPerDay: 5,
} as const;

export type LiveMessage = {
  /** 1-based position in the thread: the browser asks for everything after the last `n` it has. */
  n: number;
  from: "visitor" | "vishal";
  text: string;
  /** Epoch milliseconds. */
  t: number;
};

export type Conv = {
  id: string;
  /** Six characters Vishal can type: `/block a1b2c3`. */
  short: string;
  name: string;
  email: string | null;
  org: string | null;
  page: string;
  /** Salted hash of the visitor's IP (never the IP itself), so a block can outlast the thread. */
  ipHash: string;
  createdAt: number;
  blocked: boolean;
  optOut: boolean;
  lastVisitorAt: number;
  lastOwnerAt: number | null;
  /** Where it began: the live panel, or a message confirmed in GRID's chat. */
  via: "live" | "grid";
};

export type PresenceMode = "auto" | "online" | "away";
export type Presence = {
  mode: PresenceMode;
  /** Bengaluru hours in which he is reachable, e.g. 10 to 22, or null. */
  hours: { from: number; to: number } | null;
  /** Epoch ms of his last message or command in Telegram. */
  lastActiveAt: number | null;
};
export const DEFAULT_PRESENCE: Presence = { mode: "auto", hours: null, lastActiveAt: null };

export type PresenceState = "online" | "away";
export type PresenceView = { state: PresenceState; label: string; time: string; configured: boolean };
/** What /api/live/presence returns: the view plus his public email address (for "write to him instead"). */
export type PresenceInfo = PresenceView & { email: string };
