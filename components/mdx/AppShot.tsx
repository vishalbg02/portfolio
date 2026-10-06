/**
 * A real capture of a desktop app on a case study (LanSymphony / ZeroConnect is a desktop window, not a web page, so it
 * is not in the Work media pipeline). Drawn in a plain window frame with corner brackets; the pre-encoded AVIF/WebP
 * pair (-1x/-2x) lives in public/media/<slug>/. Captions describe only what is visible. Server component.
 */
const SHOTS = {
  "ls-app": {
    src: "/media/lansymphony/ls-app",
    width: 1280,
    height: 719,
    title: "ZeroConnect - Secure P2P Communication Platform",
    alt: "ZeroConnect's window: a sidebar with the display name, peer discovery with a Refresh button and manual IP entry, and a Connect button; the main area shows the secure chat tab with Chat, Video and Screen tabs at the top and an AI button.",
    caption: "ZeroConnect, captured from its repository (the local IP address is blurred).",
  },
} as const;

export function AppShot({ id }: { id: keyof typeof SHOTS }) {
  const { src, width, height, alt, title, caption } = SHOTS[id];
  return (
    <figure className="brackets my-8">
      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <div aria-hidden="true" className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="flex gap-1.5">
            {[0, 1, 2].map((k) => (
              <span key={k} className="size-2.5 rounded-pill border border-border-2" />
            ))}
          </span>
          <span className="truncate font-mono text-[11px] text-muted">{title}</span>
        </div>
        <picture className="block">
          <source type="image/avif" srcSet={`${src}-1x.avif 1x, ${src}-2x.avif 2x`} />
          <source type="image/webp" srcSet={`${src}-1x.webp 1x, ${src}-2x.webp 2x`} />
          {/* pre-encoded capture */}
          <img
            src={`${src}-1x.webp`}
            alt={alt}
            width={width}
            height={height}
            loading="lazy"
            decoding="async"
            className="block h-auto w-full"
          />
        </picture>
      </div>
      <figcaption className="mt-2 font-mono text-xs text-muted">{caption}</figcaption>
    </figure>
  );
}
