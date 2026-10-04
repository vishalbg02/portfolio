import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { media, mediaFor } from "@/content/media";
import { MediaManifestSchema } from "@/lib/content/media-schema";
import { clipSources, filesFor, stillSources } from "@/lib/media/paths";
import { profile } from "@/content/profile";

const PUBLIC = join(process.cwd(), "public");

/** Paths Golden Verdict's own robots.txt keeps crawlers out of. The capture script must never visit them. */
const PRIVATE = [
  "/dashboard",
  "/login",
  "/register",
  "/forgot-password",
  "/api/",
  "/quote/",
  "/invite/",
  "/create",
];

describe("media manifest (content/media.ts)", () => {
  it("is valid, with unique ids", () => {
    expect(MediaManifestSchema.safeParse(media).success).toBe(true);
    expect(new Set(media.map((m) => m.id)).size).toBe(media.length);
  });

  it("gives every asset real alt text (no placeholder, says what is shown)", () => {
    for (const a of media) {
      expect(a.alt, a.id).not.toMatch(/placeholder|todo|lorem/i);
      expect(a.alt.length, a.id).toBeGreaterThanOrEqual(40);
    }
  });

  it("covers the projects that have a public UI, and only those", () => {
    const slugs = new Set(media.map((m) => m.slug));
    expect(slugs).toEqual(new Set(["golden-verdict", "talnio", "virtual-tour"]));
    // LanSymphony has no public UI: its scene is the protocol diagram drawn in code
    expect(mediaFor("lansymphony")).toHaveLength(0);
    for (const slug of slugs) expect(profile.projects.some((p) => p.slug === slug)).toBe(true);
  });

  it("every web capture is a public page: never a login, dashboard or API route", () => {
    for (const a of media) {
      const { pathname } = new URL(a.source);
      for (const p of PRIVATE) expect(pathname, `${a.id} → ${a.source}`).not.toContain(p);
    }
  });

  it("is named by one convention (stills 1×/2× × AVIF/WebP; clips WebM + MP4 + poster)", () => {
    const still = media.find((m) => m.id === "gv-home-desktop")!;
    expect(stillSources(still)).toMatchObject({
      avif1x: "/media/golden-verdict/gv-home-desktop-1x.avif",
      webp2x: "/media/golden-verdict/gv-home-desktop-2x.webp",
      fallback: "/media/golden-verdict/gv-home-desktop-1x.webp",
    });
    const clip = media.find((m) => m.kind === "clip")!;
    const c = clipSources(clip);
    expect(c.webm).toBe(`/media/${clip.slug}/${clip.id}.webm`);
    expect(c.mp4).toBe(`/media/${clip.slug}/${clip.id}.mp4`);
    expect(c.poster.fallback).toBe(`/media/${clip.slug}/${clip.id}-poster-1x.webp`);
    expect(filesFor(still)).toHaveLength(4);
    expect(filesFor(clip)).toHaveLength(6);
  });
});

describe("media files on disk (public/media)", () => {
  it("every asset has all of its files", () => {
    const missing = media.flatMap((a) => filesFor(a).filter((f) => !existsSync(join(PUBLIC, f))));
    expect(missing, "run `pnpm media` to capture these").toEqual([]);
  });

  it("clips are ≤ 1.2 MB each; every still file stays small", () => {
    for (const a of media) {
      for (const f of filesFor(a)) {
        const size = statSync(join(PUBLIC, f)).size;
        if (/\.(webm|mp4)$/.test(f)) expect(size, f).toBeLessThanOrEqual(1_200_000);
        else expect(size, f).toBeLessThanOrEqual(400_000);
      }
    }
  });

  it("the 2× file is exactly twice the 1× size", async () => {
    const sharp = (await import("sharp")).default;
    const a = media.find((m) => m.id === "tn-login")!;
    const s = stillSources(a);
    const one = await sharp(join(PUBLIC, s.webp1x)).metadata();
    const two = await sharp(join(PUBLIC, s.webp2x)).metadata();
    expect(one.width).toBe(a.width);
    expect(two.width).toBe(a.width * 2);
    expect(Math.abs((one.height ?? 0) - a.height)).toBeLessThanOrEqual(1);
  });
});
