import { describe, expect, it } from "vitest";
import { jumpTarget, parseProofHash, splitUrl } from "@/lib/proof";

describe("jump to proof", () => {
  it("splits a source url into path and section id", () => {
    expect(splitUrl("/work/talnio#architecture")).toEqual({ path: "/work/talnio", id: "architecture" });
    expect(splitUrl("/#github")).toEqual({ path: "/", id: "github" });
    expect(splitUrl("/resume")).toEqual({ path: "/resume", id: null });
    expect(splitUrl("/")).toEqual({ path: "/", id: null });
  });
  it("same page + anchor → scroll and flash", () => {
    expect(jumpTarget("/#github", "/")).toEqual({ type: "scroll", id: "github" });
    expect(jumpTarget("/work/talnio#outcome", "/work/talnio")).toEqual({ type: "scroll", id: "outcome" });
  });
  it("another page + anchor → navigate with #proof=<id>", () => {
    expect(jumpTarget("/#experience", "/work/talnio")).toEqual({
      type: "navigate",
      href: "/#proof=experience",
    });
    expect(jumpTarget("/work/talnio#architecture", "/")).toEqual({
      type: "navigate",
      href: "/work/talnio#proof=architecture",
    });
  });
  it("no anchor → plain navigation (even on the same page)", () => {
    expect(jumpTarget("/resume", "/")).toEqual({ type: "navigate", href: "/resume" });
    expect(jumpTarget("/", "/")).toEqual({ type: "navigate", href: "/" });
  });
  it("parses #proof=<id> and refuses anything that isn't a plain id (the hash is user-controlled)", () => {
    expect(parseProofHash("#proof=architecture")).toBe("architecture");
    expect(parseProofHash("#proof=key-decisions")).toBe("key-decisions");
    expect(parseProofHash("#architecture")).toBeNull();
    for (const bad of [
      "#proof=",
      "#proof=<img src=x>",
      "#proof=a b",
      "#proof=../x",
      "#proof=A",
      `#proof=${"a".repeat(80)}`,
    ])
      expect(parseProofHash(bad), bad).toBeNull();
  });
});
