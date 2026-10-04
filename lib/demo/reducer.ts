/**
 * State of a ProductDemo (the click-through illustrations in the case studies). Pure, so the
 * rules are unit-tested: auto-play runs once and any human input stops it for good.
 */
export type DemoState = {
  step: number;
  role: number;
  /** idle → playing (auto-advance, once) → done; any user input → stopped. */
  auto: "idle" | "playing" | "done" | "stopped";
  /** true once the visitor has driven the demo themselves (so auto-play never restarts on scroll). */
  touched: boolean;
};

export type DemoAction =
  | { type: "goto"; step: number }
  | { type: "next" }
  | { type: "prev" }
  | { type: "role"; role: number }
  | { type: "autoStart" }
  | { type: "autoTick" }
  | { type: "replay" };

export const initialDemo: DemoState = { step: 0, role: 0, auto: "idle", touched: false };

export function demoReducer(
  state: DemoState,
  action: DemoAction,
  dims: { steps: number; roles: number },
): DemoState {
  const last = Math.max(0, dims.steps - 1);
  const clamp = (n: number) => Math.min(last, Math.max(0, n));
  const driven = { auto: "stopped" as const, touched: true };
  switch (action.type) {
    case "goto":
      return { ...state, ...driven, step: clamp(action.step) };
    case "next":
      return { ...state, ...driven, step: clamp(state.step + 1) };
    case "prev":
      return { ...state, ...driven, step: clamp(state.step - 1) };
    case "role":
      return {
        ...state,
        ...driven,
        role: Math.min(Math.max(0, dims.roles - 1), Math.max(0, action.role)),
      };
    case "autoStart":
      // only the first time, and never over the top of a visitor who is already using it
      return state.auto === "idle" && !state.touched && dims.steps > 1
        ? { ...state, auto: "playing" }
        : state;
    case "autoTick":
      if (state.auto !== "playing") return state;
      return state.step >= last ? { ...state, auto: "done" } : { ...state, step: state.step + 1 };
    case "replay":
      return { ...state, step: 0, auto: "playing", touched: true };
  }
}
