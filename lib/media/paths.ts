import type { MediaAsset, MediaClip, MediaStill } from "@/lib/content/media-schema";

/**
 * Where a capture lives. Naming is a convention, not data, so the capture script, the manifest and the
 * components can never disagree: /media/<slug>/<id>-<1x|2x>.<avif|webp> for stills, and for clips
 * /media/<slug>/<id>.<webm|mp4> plus a poster still called <id>-poster.
 */
const dir = (a: Pick<MediaAsset, "slug">) => `/media/${a.slug}`;

export type StillSources = {
  avif1x: string;
  avif2x: string;
  webp1x: string;
  webp2x: string;
  /** What <img src> falls back to (WebP 1×). */
  fallback: string;
  /** srcSet strings for <source type=…> */
  avifSet: string;
  webpSet: string;
  width: number;
  height: number;
};

export function stillSources(a: Pick<MediaStill, "id" | "slug" | "width" | "height">): StillSources {
  const base = `${dir(a)}/${a.id}`;
  const f = (x: "1x" | "2x", ext: "avif" | "webp") => `${base}-${x}.${ext}`;
  return {
    avif1x: f("1x", "avif"),
    avif2x: f("2x", "avif"),
    webp1x: f("1x", "webp"),
    webp2x: f("2x", "webp"),
    fallback: f("1x", "webp"),
    avifSet: `${f("1x", "avif")} 1x, ${f("2x", "avif")} 2x`,
    webpSet: `${f("1x", "webp")} 1x, ${f("2x", "webp")} 2x`,
    width: a.width,
    height: a.height,
  };
}

export type ClipSources = {
  webm: string;
  mp4: string;
  poster: StillSources;
};

export function clipSources(a: Pick<MediaClip, "id" | "slug" | "width" | "height">): ClipSources {
  const base = `${dir(a)}/${a.id}`;
  return {
    webm: `${base}.webm`,
    mp4: `${base}.mp4`,
    poster: stillSources({ ...a, id: `${a.id}-poster` }),
  };
}

/** Every file a manifest entry needs on disk, relative to /public. Used by the script and the unit test. */
export function filesFor(a: MediaAsset): string[] {
  if (a.kind === "still") {
    const s = stillSources(a);
    return [s.avif1x, s.avif2x, s.webp1x, s.webp2x].map((p) => p.slice(1));
  }
  const c = clipSources(a);
  const p = c.poster;
  return [c.webm, c.mp4, p.avif1x, p.avif2x, p.webp1x, p.webp2x].map((x) => x.slice(1));
}
