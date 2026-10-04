import { mediaById } from "@/content/media";
import type { MediaClip, MediaStill } from "@/lib/content/media-schema";
import { clipSources, stillSources } from "@/lib/media/paths";
import { cn } from "@/lib/utils/cn";

/**
 * How wide a Work picture is shown: about 58 % of the page on a desktop (never more than 760 px), nearly the full width
 * of a card (at most 520 px) on a phone. Telling the browser lets it pick the 1× file on a phone instead of the
 * 2× one, which is twice the bytes for pixels the screen can't show.
 */
export const STAGE_SIZES = "(min-width: 1024px) min(58vw, 760px), min(92vw, 520px)";

/**
 * A pre-encoded capture as <picture> (AVIF, then WebP; 1× and 2×) with its real width and height, so the
 * browser reserves the space. Lazy unless it is the first thing on screen.
 */
export function MediaStill({
  asset,
  priority = false,
  className,
  sizes = STAGE_SIZES,
}: {
  asset: MediaStill;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  const s = stillSources(asset);
  return (
    <picture>
      <source type="image/avif" srcSet={s.avifSetW} sizes={sizes} />
      <source type="image/webp" srcSet={s.webpSetW} sizes={sizes} />
      {/* pre-encoded AVIF/WebP at 1× and 2×: a re-encode through next/image would only cost quality */}
      <img
        src={s.fallback}
        alt={asset.alt}
        width={s.width}
        height={s.height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={cn("block size-full object-cover object-top", className)}
      />
    </picture>
  );
}

/**
 * A muted, looping clip. Nothing is downloaded until it plays (preload="none"). The poster is a `poster`
 * attribute the controller sets when the card is about to be seen: a poster in the markup is fetched at once,
 * even for a card far down a page or off to the side of the deck, and it would be the heaviest thing a visitor
 * downloads before the first paint. It plays when its card is on screen, never under reduced motion, and the
 * Pause / Play button satisfies "pause, stop, hide" for anything that moves by itself.
 */
export function MediaClip({ asset, className }: { asset: MediaClip; className?: string }) {
  const c = clipSources(asset);
  return (
    <div className={cn("relative size-full", className)}>
      <video
        data-clip={asset.id}
        muted
        loop
        playsInline
        preload="none"
        data-poster={c.poster.fallback}
        aria-label={asset.alt}
        width={asset.width}
        height={asset.height}
        className="block size-full object-cover object-top"
      >
        <source src={c.webm} type="video/webm" />
        <source src={c.mp4} type="video/mp4" />
      </video>
      <button
        type="button"
        data-clip-toggle
        aria-pressed="false"
        aria-label="Play video"
        className="absolute right-2 bottom-2 inline-flex h-8 items-center gap-1.5 rounded-pill border border-border-2 bg-bg px-3 font-mono text-[11px] text-text transition-colors hover:border-accent hover:text-accent pointer-coarse:h-11"
      >
        <span aria-hidden="true" data-clip-icon>
          ▶
        </span>
        <span data-clip-label>Play</span>
      </button>
    </div>
  );
}

/** A clip's poster frame as a still: for places that show a capture without playing anything (cards, headers). */
export function MediaPoster({
  asset,
  priority = false,
  className,
}: {
  asset: MediaClip;
  priority?: boolean;
  className?: string;
}) {
  const s = clipSources(asset).poster;
  return (
    <picture>
      <source type="image/avif" srcSet={s.avifSetW} sizes={STAGE_SIZES} />
      <source type="image/webp" srcSet={s.webpSetW} sizes={STAGE_SIZES} />
      {/* pre-encoded poster at 1× and 2× */}
      <img
        src={s.fallback}
        alt={asset.alt}
        width={s.width}
        height={s.height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={cn("block size-full object-cover object-top", className)}
      />
    </picture>
  );
}

/** Looks a media reference up in the manifest (throws if it is missing: a typo fails the build). */
export function resolveMedia(id: string, kind: "still"): MediaStill;
export function resolveMedia(id: string, kind: "clip"): MediaClip;
export function resolveMedia(id: string, kind: "still" | "clip") {
  const m = mediaById(id);
  if (!m || m.kind !== kind) throw new Error(`content/media.ts has no ${kind} "${id}"`);
  return m;
}
