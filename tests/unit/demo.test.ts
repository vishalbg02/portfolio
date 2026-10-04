import { describe, expect, it } from "vitest";
import { demoReducer, initialDemo, type DemoAction, type DemoState } from "@/lib/demo/reducer";

const dims = { steps: 4, roles: 4 };
const run = (actions: DemoAction[], from: DemoState = initialDemo) =>
  actions.reduce((s, a) => demoReducer(s, a, dims), from);

describe("demo reducer", () => {
  it("auto-play starts once and walks to the last step, then stops (never loops)", () => {
    let s = run([{ type: "autoStart" }]);
    expect(s.auto).toBe("playing");
    s = run([{ type: "autoTick" }, { type: "autoTick" }, { type: "autoTick" }], s);
    expect(s.step).toBe(3);
    expect(s.auto).toBe("playing");
    s = run([{ type: "autoTick" }], s);
    expect(s).toMatchObject({ step: 3, auto: "done" });
    expect(run([{ type: "autoTick" }, { type: "autoStart" }], s)).toEqual(s); // done stays done
  });
  it("any human input stops auto-play for good", () => {
    for (const a of [
      { type: "next" },
      { type: "prev" },
      { type: "goto", step: 2 },
      { type: "role", role: 1 },
    ] as DemoAction[]) {
      const s = run([{ type: "autoStart" }, a]);
      expect(s.auto, a.type).toBe("stopped");
      expect(s.touched).toBe(true);
      expect(run([{ type: "autoStart" }, { type: "autoTick" }], s)).toEqual(s);
    }
  });
  it("does not start over a visitor who already used it", () => {
    expect(run([{ type: "next" }, { type: "autoStart" }]).auto).toBe("stopped");
  });
  it("clamps steps and roles", () => {
    expect(run([{ type: "prev" }]).step).toBe(0);
    expect(run([{ type: "goto", step: 99 }]).step).toBe(3);
    expect(run([{ type: "role", role: 99 }]).role).toBe(3);
    expect(run([{ type: "role", role: -2 }]).role).toBe(0);
  });
  it("a single-step demo has nothing to auto-play", () => {
    expect(demoReducer(initialDemo, { type: "autoStart" }, { steps: 1, roles: 0 }).auto).toBe("idle");
  });
  it("replay restarts from step 1 and plays once more", () => {
    const s = run([{ type: "goto", step: 3 }, { type: "replay" }]);
    expect(s).toMatchObject({ step: 0, auto: "playing" });
  });
  it("changing role keeps the step", () => {
    expect(
      run([
        { type: "goto", step: 2 },
        { type: "role", role: 3 },
      ]),
    ).toMatchObject({ step: 2, role: 3 });
  });
});
