import { describe, expect, it } from "vitest";
import { findGradients, scan } from "@/scripts/check-no-gradients";

describe("gradient checker", () => {
  it.each([
    ["background: linear-gradient(90deg, red, blue);", "css-gradient"],
    ["background-image: radial-gradient(circle, #000, #fff);", "css-gradient"],
    ["background: conic-gradient(from 0deg, red, blue);", "css-gradient"],
    ["background: repeating-linear-gradient(45deg, red 0 2px, blue 2px 4px);", "css-gradient"],
    ['<div className="bg-linear-to-r from-accent to-link" />', "tailwind-gradient"],
    ['<div className="bg-radial-[at_50%_75%] from-accent" />', "tailwind-gradient"],
    ['<div className="bg-conic-180 from-accent" />', "tailwind-gradient"],
    ['<div className="bg-gradient-to-br from-accent" />', "tailwind-gradient"],
    ['<div className="mask-linear-to-b" />', "tailwind-mask-gradient"],
    ['<linearGradient id="g"><stop offset="0" /></linearGradient>', "svg-gradient"],
    ['<radialGradient id="g" />', "svg-gradient"],
    ["const g = ctx.createLinearGradient(0, 0, 10, 10);", "canvas-gradient"],
    ["const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 10);", "canvas-gradient"],
    ["const g = ctx.createConicGradient(0, 5, 5);", "canvas-gradient"],
  ])("catches %s", (input, rule) => {
    const found = findGradients(input);
    expect(found.map((m) => m.rule)).toContain(rule);
  });

  it.each([
    '<div className="bg-surface border-border text-accent" />',
    "background-color: var(--surface);",
    "// We never use gradients here.",
    '<div className="bg-grid-4" />',
    'const cls = "hover:bg-surface-2";',
  ])("allows flat usage: %s", (input) => {
    expect(findGradients(input)).toEqual([]);
  });

  it("reports line numbers", () => {
    const [m] = findGradients("a\nb\nbackground: linear-gradient(red, blue);", "x.css");
    expect(m).toMatchObject({ file: "x.css", line: 3 });
  });

  it("finds no gradients in the repository", () => {
    expect(scan(process.cwd())).toEqual([]);
  });
});
