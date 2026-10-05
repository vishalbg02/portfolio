import { describe, expect, it } from "vitest";
import { intersects, omniMode, pillRect, puckRect, samplePoints, type OmniInput } from "@/lib/grid/overlap";

const calm: OmniInput = {
  dir: "none",
  field: false,
  footer: false,
  escaped: false,
  coversPill: false,
  coversPuck: false,
};

describe("Omnibar geometry", () => {
  it("the pill is min(520, 100vw - 48) wide, 48 tall, centred, 20 px up (or the safe area)", () => {
    expect(pillRect(1440, 900)).toEqual({ left: 460, right: 980, top: 832, bottom: 880 });
    expect(pillRect(500, 900).right - pillRect(500, 900).left).toBe(452);
    expect(pillRect(1440, 900, 34).bottom).toBe(866);
  });
  it("the puck is 48 × 48 in the bottom-right corner", () => {
    expect(puckRect(1440, 900)).toEqual({ left: 1372, right: 1420, top: 832, bottom: 880 });
  });
  it("samples two rows of points inside the rect", () => {
    const pts = samplePoints({ left: 0, right: 100, top: 0, bottom: 50 }, 5, 6);
    expect(pts).toHaveLength(10);
    expect(pts.every((p) => p.x >= 6 && p.x <= 94 && (p.y === 6 || p.y === 44))).toBe(true);
    expect(
      intersects({ left: 0, right: 10, top: 0, bottom: 10 }, { left: 10, right: 20, top: 0, bottom: 10 }),
    ).toBe(false);
  });
});

describe("pill, puck or tab", () => {
  it("the pill at rest and while scrolling up, when nothing is under it", () => {
    expect(omniMode(calm)).toBe("pill");
    expect(omniMode({ ...calm, dir: "up" })).toBe("pill");
  });
  it.each([
    ["scrolling down", { dir: "down" as const }],
    ["a field has focus", { field: true }],
    ["the footer is on screen", { footer: true }],
    ["Esc", { escaped: true }],
    ["the pill would cover a control", { coversPill: true }],
  ])("the puck when %s", (_w, change) => {
    expect(omniMode({ ...calm, ...change })).toBe("puck");
  });
  it("tucked into the edge when even the puck would cover a control", () => {
    expect(omniMode({ ...calm, dir: "down", coversPuck: true })).toBe("tab");
    // the puck's own overlap only matters once collapsed
    expect(omniMode({ ...calm, coversPuck: true })).toBe("pill");
  });
});
