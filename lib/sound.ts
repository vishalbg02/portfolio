import { track } from "@/lib/analytics";

/**
 * Sound, off by default. Everything is synthesised with Web Audio (no audio files): a soft key tick in the terminal,
 * a click when a Work scene changes, a two-note chime when a message to Vishal is delivered or he replies. The volume
 * is low, nothing plays before the visitor has interacted with the page (an AudioContext is only created inside a
 * gesture), and the choice is remembered in this browser only.
 */
export const SOUND_KEY = "sound:v1";
export const SOUND_EVENT = "app:sound";

export type Cue = "tick" | "click" | "chime";

/** A cue as a few notes: frequency (Hz), start offset and length (s), waveform and peak gain. */
export type Note = { f: number; at: number; len: number; wave: OscillatorType; gain: number };
export const CUES: Record<Cue, Note[]> = {
  tick: [{ f: 2400, at: 0, len: 0.018, wave: "square", gain: 0.012 }],
  click: [{ f: 760, at: 0, len: 0.045, wave: "triangle", gain: 0.03 }],
  chime: [
    { f: 880, at: 0, len: 0.18, wave: "sine", gain: 0.04 },
    { f: 1318.5, at: 0.11, len: 0.32, wave: "sine", gain: 0.035 },
  ],
};
/** The quietest a repeated cue may repeat, in ms (a held key must not machine-gun). */
export const MIN_GAP: Record<Cue, number> = { tick: 45, click: 120, chime: 600 };

const storage = () => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const readPref = (): boolean => storage()?.getItem(SOUND_KEY) === "on";

let ctx: AudioContext | null = null;
let on = false;
let primed = false;
const lastAt: Partial<Record<Cue, number>> = {};

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    typeof window === "undefined"
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** With the sound already on from an earlier visit, the audio context waits for the first real gesture. */
function armOnGesture() {
  if (primed || typeof window === "undefined") return;
  primed = true;
  const go = () => {
    window.removeEventListener("pointerdown", go);
    window.removeEventListener("keydown", go);
    if (on) void context()?.resume();
  };
  window.addEventListener("pointerdown", go, { once: true });
  window.addEventListener("keydown", go, { once: true });
}

/** Reads the saved choice (call once on the client). */
export function initSound() {
  on = readPref();
  if (on) armOnGesture();
  return on;
}
export const soundOn = () => on;

/** Turns sound on or off. Turning it on must come from a click or key press: that gesture creates the audio context. */
export function setSound(next: boolean) {
  on = next;
  try {
    storage()?.setItem(SOUND_KEY, next ? "on" : "off");
  } catch {
    /* blocked: it holds for this visit */
  }
  if (next) {
    const c = context();
    void c?.resume();
    track("sound_on");
    play("click");
  }
  window.dispatchEvent(new CustomEvent(SOUND_EVENT, { detail: { on: next } }));
}

export function play(cue: Cue) {
  if (!on) return;
  const c = ctx;
  if (!c || c.state !== "running") return;
  const now = performance.now();
  if (now - (lastAt[cue] ?? -Infinity) < MIN_GAP[cue]) return;
  lastAt[cue] = now;
  const t0 = c.currentTime;
  for (const n of CUES[cue]) {
    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = n.wave;
    osc.frequency.value = n.f;
    const start = t0 + n.at;
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(n.gain, start + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + n.len);
    osc.connect(amp).connect(c.destination);
    osc.start(start);
    osc.stop(start + n.len + 0.02);
  }
}

export function subscribeSound(cb: () => void) {
  window.addEventListener(SOUND_EVENT, cb);
  return () => window.removeEventListener(SOUND_EVENT, cb);
}
