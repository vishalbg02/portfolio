/**
 * How the browser hears about replies. Server-sent events would hold a function open for the whole chat, so the browser
 * asks instead: a cheap "anything new?" every few seconds while it is looking at the chat, slower the longer nothing
 * happens, slowest in a hidden tab, and not at all after half an hour of silence. The server answers "unchanged" with a
 * single Redis read, which keeps a chat well inside Upstash's free plan.
 */
export const POLL = {
  activeMs: 3_000,
  quietMs: 8_000,
  idleMs: 20_000,
  hiddenMs: 30_000,
  stopAfterMs: 30 * 60_000,
} as const;

/** How long to wait before the next ask, given how long it has been since anything was said. */
export function nextDelay(sinceActivityMs: number, hidden: boolean): number | null {
  if (sinceActivityMs >= POLL.stopAfterMs) return null;
  if (hidden) return POLL.hiddenMs;
  if (sinceActivityMs < 2 * 60_000) return POLL.activeMs;
  if (sinceActivityMs < 10 * 60_000) return POLL.quietMs;
  return POLL.idleMs;
}

export type PollerDeps = {
  /** Asks the server; resolves true when something new arrived. May throw (the poller keeps going). */
  poll: () => Promise<boolean>;
  now?: () => number;
  hidden?: () => boolean;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
  /** Called when polling has stopped for inactivity; `resume()` starts it again. */
  onIdle?: () => void;
};

export function createPoller(deps: PollerDeps) {
  const now = deps.now ?? Date.now;
  const hidden =
    deps.hidden ?? (() => typeof document !== "undefined" && document.visibilityState === "hidden");
  const setT = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearT = deps.clearTimer ?? ((id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>));
  let timer: unknown = null;
  let running = false;
  let lastActivity = now();

  const schedule = () => {
    if (!running) return;
    const delay = nextDelay(now() - lastActivity, hidden());
    if (delay === null) {
      running = false;
      deps.onIdle?.();
      return;
    }
    timer = setT(tick, delay);
  };
  const tick = async () => {
    timer = null;
    if (!running) return;
    try {
      if (await deps.poll()) lastActivity = now();
    } catch {
      /* a failed ask is just asked again later */
    }
    schedule();
  };

  return {
    /** Start asking. */
    start() {
      if (running) return;
      running = true;
      lastActivity = now();
      schedule();
    },
    /** The visitor did something (sent a message): ask more often again. */
    activity() {
      lastActivity = now();
      if (!running) this.start();
      else if (timer !== null) {
        clearT(timer);
        schedule();
      }
    },
    /** Ask right now (the tab came back into view). */
    nudge() {
      if (!running) return;
      if (timer !== null) clearT(timer);
      void tick();
    },
    stop() {
      running = false;
      if (timer !== null) clearT(timer);
      timer = null;
    },
    get running() {
      return running;
    },
  };
}
