import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { displayScore, fromManifest, readLighthouse, type ManifestEntry } from "@/lib/lighthouse";

const meta = { generatedAt: "2026-10-04T10:00:00.000Z", commit: "abc1234", runUrl: null };
const run = (p: number, rep = false): ManifestEntry => ({
  url: "https://vishalbg.vercel.app/",
  isRepresentativeRun: rep,
  summary: { performance: p, accessibility: 1, "best-practices": 1, seo: 0.99 },
});

describe("Lighthouse strip data", () => {
  it("never rounds a score up", () => {
    expect(displayScore(0.996)).toBe(99);
    expect(displayScore(0.9999)).toBe(99);
    expect(displayScore(1)).toBe(100);
    expect(displayScore(0.95)).toBe(95);
    expect(displayScore(0.949)).toBe(94);
  });
  it("takes the representative (median) run, not the best one", () => {
    const d = fromManifest([run(1), run(0.97, true), run(0.93)], meta);
    expect(d.scores.performance).toBe(0.97);
    expect(d.scores.bestPractices).toBe(1);
    expect(d.runs).toBe(3);
    expect(d.formFactor).toBe("mobile");
  });
  it("falls back to the first run when none is marked representative", () => {
    expect(fromManifest([run(0.9), run(1)], meta).scores.performance).toBe(0.9);
  });
  it("refuses an empty manifest or out-of-range scores", () => {
    expect(() => fromManifest([], meta)).toThrow();
    expect(() => fromManifest([run(1.4, true)], meta)).toThrow();
  });
  it("reads a good file, and returns null for a missing or malformed one (the strip hides)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lh-"));
    const good = path.join(dir, "good.json");
    writeFileSync(good, JSON.stringify(fromManifest([run(0.98, true)], meta)));
    expect(readLighthouse(good)?.scores.performance).toBe(0.98);
    expect(readLighthouse(path.join(dir, "missing.json"))).toBeNull();
    const bad = path.join(dir, "bad.json");
    writeFileSync(bad, '{"scores":{"performance":"high"}}');
    expect(readLighthouse(bad)).toBeNull();
  });
});
