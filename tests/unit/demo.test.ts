import { describe, expect, it } from "vitest";
import { DEMO_QUESTIONS, buildDemoScenes } from "@/lib/ai/agent/demo";
import {
  clipAnswer,
  frameAt,
  sceneDuration,
  TIMING,
  TOOL_DONE,
  TOOL_WORKING,
  type DemoScene,
} from "@/lib/grid/demo";
import { TOOL_NAMES } from "@/lib/ai/protocol";

const scene: DemoScene = {
  q: "Show me Talnio",
  text: "Here is Talnio: a platform. [1]",
  sources: [{ n: 1, title: "Talnio — case study", url: "/work/talnio" }],
  parts: [],
  tool: "show_project",
};

describe("the Ask section's demo scenes", () => {
  it("are the router's real answers to the demo questions, in order, none dropped", async () => {
    const scenes = await buildDemoScenes();
    expect(scenes.map((s) => s.q)).toEqual([...DEMO_QUESTIONS]);
    for (const s of scenes) {
      expect(s.text.length, s.q).toBeGreaterThan(10);
      expect(s.parts.length, s.q).toBeGreaterThan(0);
      expect(s.tool, s.q).not.toBeNull();
      // every citation in the text has its source, so nothing in the demo is unlinked
      for (const n of [...s.text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))
        expect(s.sources[n - 1], `${s.q}: [${n}]`).toBeDefined();
    }
  });

  it("never reaches the network or the live presence store at build time, and stays small", async () => {
    const scenes = await buildDemoScenes();
    expect(scenes.some((s) => s.parts.some((p) => p.kind === "live" || p.kind === "stats"))).toBe(false);
    expect(JSON.stringify(scenes).length).toBeLessThan(5_000);
  });

  it("have a working line and a done line for every tool they use", async () => {
    for (const s of await buildDemoScenes()) {
      expect(TOOL_WORKING[s.tool!], s.q).toBeTruthy();
      expect(TOOL_DONE[s.tool!], s.q).toBeTruthy();
    }
    // every tool has both lines, so the chat never falls back to a generic "Working"
    expect(Object.keys(TOOL_WORKING).sort()).toEqual([...TOOL_NAMES].sort());
    expect(Object.keys(TOOL_DONE).sort()).toEqual([...TOOL_NAMES].sort());
  });
});

describe("the demo's timeline", () => {
  it("types, sends, thinks, works, answers and settles, in that order", () => {
    expect(frameAt(scene, 0)).toMatchObject({ phase: "type", typed: 0, cards: false });
    const typed = frameAt(scene, TIMING.typeStart + TIMING.perChar * 5);
    expect(typed).toMatchObject({ phase: "type", typed: 5 });
    const typeEnd = TIMING.typeStart + TIMING.perChar * scene.q.length;
    expect(frameAt(scene, typeEnd + 10)).toMatchObject({ phase: "type", typed: scene.q.length });
    const think = typeEnd + TIMING.sendPause;
    expect(frameAt(scene, think + 10).phase).toBe("think");
    const tool = think + TIMING.think;
    expect(frameAt(scene, tool + 10).phase).toBe("tool");
    const answer = tool + TIMING.tool;
    expect(frameAt(scene, answer + 100)).toMatchObject({ phase: "answer", cards: true });
    expect(frameAt(scene, sceneDuration(scene) - 1)).toMatchObject({
      phase: "hold",
      typed: scene.q.length,
      shown: scene.text.length,
      cards: true,
    });
  });

  it("skips the working line when the scene has no tool", () => {
    const plain = { ...scene, tool: null };
    expect(sceneDuration(plain)).toBe(sceneDuration(scene) - TIMING.tool);
    const phases = new Set<string>();
    for (let t = 0; t < sceneDuration(plain); t += 20) phases.add(frameAt(plain, t).phase);
    expect(phases.has("tool")).toBe(false);
  });

  it("only ever moves forward", () => {
    let last = frameAt(scene, 0);
    for (let t = 0; t <= sceneDuration(scene); t += 25) {
      const f = frameAt(scene, t);
      expect(f.typed).toBeGreaterThanOrEqual(last.typed);
      expect(f.shown).toBeGreaterThanOrEqual(last.shown);
      last = f;
    }
  });

  it("the settled frame (paused, reduced motion) is the same at any time past the end", () => {
    expect(frameAt(scene, sceneDuration(scene))).toEqual(frameAt(scene, sceneDuration(scene) + 60_000));
  });
});

describe("clipAnswer", () => {
  it("never leaves half a citation on screen", () => {
    expect(clipAnswer("Here is Talnio. [1]", 16).trimEnd()).toBe("Here is Talnio.");
    expect(clipAnswer("Here is Talnio. [1]", 17)).toBe("Here is Talnio.");
    expect(clipAnswer("Here is Talnio. [12]", 18)).toBe("Here is Talnio.");
    expect(clipAnswer("Here is Talnio. [1]", 19)).toBe("Here is Talnio. [1]");
    expect(clipAnswer("abc", 99)).toBe("abc");
    expect(clipAnswer("abc", -4)).toBe("");
  });
});
