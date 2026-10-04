import { sceneFor } from "@/content/scenes";
import type { Project } from "@/lib/content/profile-schema";
import { clipSources } from "@/lib/media/paths";
import { resolveMedia } from "./Media";
import { GalleryViewer } from "./GalleryViewer";
import { viewerItems } from "./viewer-items";

/**
 * "Captures from the live product" on a case study: every still of the project, each opening the full-screen
 * viewer, and its clip with native controls (muted, nothing is downloaded until it is played). Projects with no
 * public UI (LanSymphony) have nothing to show here, so it renders nothing.
 */
export function Gallery({ project }: { project: Project }) {
  const items = viewerItems(project.slug);
  const hero = sceneFor(project.slug)?.hero;
  const clip = hero?.type === "clip" ? resolveMedia(hero.id, "clip") : null;
  if (items.length === 0 && !clip) return null;
  const c = clip ? clipSources(clip) : null;

  return (
    <section aria-labelledby="gallery-h" className="mt-12">
      <h2 id="gallery-h" className="font-mono text-xs tracking-[0.12em] text-muted uppercase">
        Captured from the live product
      </h2>
      <GalleryViewer slug={project.slug} name={project.name} items={items}>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <li key={it.id}>
              <button
                type="button"
                data-gallery-open={i}
                aria-label={`View larger: ${it.alt}`}
                className="group block w-full overflow-hidden rounded-card border border-border bg-surface text-left transition-colors hover:border-border-2"
              >
                <span
                  className={
                    it.frame === "phone"
                      ? "stage-grid flex aspect-[8/5] items-center justify-center py-3"
                      : "block aspect-[8/5]"
                  }
                >
                  <picture className="block h-full">
                    <source type="image/avif" srcSet={it.avifSet} />
                    <source type="image/webp" srcSet={it.webpSet} />
                    {/* pre-encoded capture */}
                    <img
                      src={it.src}
                      alt=""
                      width={it.width}
                      height={it.height}
                      loading="lazy"
                      decoding="async"
                      className={
                        it.frame === "phone"
                          ? "rounded-md block h-full w-auto border border-border-2"
                          : "block size-full object-cover object-top"
                      }
                    />
                  </picture>
                </span>
                <span className="block border-t border-border px-3 py-2 font-mono text-[11px] text-muted group-hover:text-text">
                  {it.caption ?? "Capture"} <span aria-hidden="true">⤢</span>
                </span>
              </button>
            </li>
          ))}
          {clip && c ? (
            <li>
              <figure className="overflow-hidden rounded-card border border-border bg-surface">
                <video
                  controls
                  muted
                  loop
                  playsInline
                  preload="none"
                  poster={c.poster.fallback}
                  aria-label={clip.alt}
                  width={clip.width}
                  height={clip.height}
                  className="block aspect-[8/5] w-full object-cover object-top"
                >
                  <source src={c.webm} type="video/webm" />
                  <source src={c.mp4} type="video/mp4" />
                </video>
                <figcaption className="border-t border-border px-3 py-2 font-mono text-[11px] text-muted">
                  Screen recording
                </figcaption>
              </figure>
            </li>
          ) : null}
        </ul>
      </GalleryViewer>
    </section>
  );
}
