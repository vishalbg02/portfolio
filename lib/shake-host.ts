import { createShakeDetector } from "./shake";

type MotionEventCtor = typeof DeviceMotionEvent & { requestPermission?: () => Promise<"granted" | "denied"> };

let off: (() => void) | null = null;

/** Can this device report motion at all? (Desktops have the constructor but never fire events; the toggle checks touch too.) */
export const shakeSupported = () => typeof DeviceMotionEvent !== "undefined";

/**
 * Turns shake detection on. iOS needs a permission prompt, which must come from a user gesture, so this is
 * only ever called from an explicit button. Resolves true when listening.
 */
export async function enableShake(onShake: () => void): Promise<boolean> {
  if (!shakeSupported()) return false;
  const ctor = DeviceMotionEvent as MotionEventCtor;
  if (typeof ctor.requestPermission === "function") {
    try {
      if ((await ctor.requestPermission()) !== "granted") return false;
    } catch {
      return false;
    }
  }
  off?.();
  const detector = createShakeDetector();
  const handler = (e: DeviceMotionEvent) => {
    const a = e.acceleration ?? e.accelerationIncludingGravity;
    if (a && detector.push(a.x ?? 0, a.y ?? 0, a.z ?? 0, e.timeStamp)) onShake();
  };
  window.addEventListener("devicemotion", handler);
  off = () => window.removeEventListener("devicemotion", handler);
  return true;
}

export function disableShake() {
  off?.();
  off = null;
}
export const shakeEnabled = () => off !== null;
