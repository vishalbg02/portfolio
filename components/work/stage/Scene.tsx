import { ViewTransition, type CSSProperties } from "react";
import { Chip } from "@/components/ui/Chip";
import type { Project } from "@/lib/content/profile-schema";
import type { MediaRef, Scene as SceneData } from "@/lib/content/scene-schema";
import { kindOf } from "@/lib/content/kind";
import { cn } from "@/lib/utils/cn";
import { identityBg } from "../identity";
import { ProjectLinks } from "../ProjectLinks";
import { ProjectStatus } from "../ProjectStatus";
import { BrowserFrame, DiagramFrame, PhoneFrame } from "./Frames";
import { Illustration } from "./illustrations/Illustration";
import { MediaClip, MediaStill, resolveMedia } from "./Media";

const MAX_CHIPS = 6;

/** One media reference as content (a still, a clip or a drawn illustration), sized by its frame. */
function Content({ media, priority = false }: { media: MediaRef; priority?: boolean }) {
  if (media.type === "illustration") return <Illustration id={media.id} />;
  if (media.type === "clip") return <MediaClip asset={resolveMedia(media.id, "clip")} />;
  return <MediaStill asset={resolveMedia(media.id, "still")} priority={priority} />;
}

/** The full-screen button: in a browser frame it sits in the window bar; elsewhere it floats in the corner. */
function Expand({ slug, name, inline }: { slug: string; name: string; inline?: boolean }) {
  return (
    <button
      type="button"
      data-viewer-open={slug}
      aria-label={`Open ${name} screens full screen`}
      className={inline ? "expand expand-inline" : "expand"}
    >
      <span aria-hidden="true">⤢</span>
    </button>
  );
}

function Framed({
  scene,
  project,
  openable,
  children,
}: {
  scene: SceneData;
  project: Project;
  openable: boolean;
  children: React.ReactNode;
}) {
  if (scene.frame === "phone") return <PhoneFrame>{children}</PhoneFrame>;
  if (scene.frame === "diagram") return <DiagramFrame label={scene.frameLabel}>{children}</DiagramFrame>;
  return (
    <BrowserFrame
      label={scene.frameLabel}
      action={openable ? <Expand slug={project.slug} name={project.name} inline /> : undefined}
    >
      {children}
    </BrowserFrame>
  );
}

/**
 * One project, told as a scene. The same server-rendered markup serves three layouts (styles/work.css):
 * pinned beats on a desktop, a story card in a phone's snap deck, and a plain row without JS or with reduced
 * motion. `.scene-beats` (the frame with one layer per beat, and the beat captions) is the desktop media;
 * `.scene-hero` (one still or clip) is the phone's.
 */
export function Scene({
  scene,
  project,
  index,
  openable,
}: {
  scene: SceneData;
  project: Project;
  index: number;
  /** Whether the project has stills the full-screen viewer can show. */
  openable: boolean;
}) {
  const id = `scene-${project.slug}`;
  const extra = project.stack.length - MAX_CHIPS;
  const isTour = project.slug === "virtual-tour";
  return (
    <article
      data-scene={index}
      data-project={project.slug}
      data-active={index === 0 ? "" : undefined}
      data-warm={index === 1 ? "" : undefined}
      aria-labelledby={`${id}-h`}
      className="scene"
    >
      <div className="scene-copy">
        <p aria-hidden="true" className="scene-index idx-num font-mono font-semibold">
          {String(index + 1).padStart(2, "0")}
        </p>
        <p className="scene-eyebrow">
          <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-pill", identityBg[project.slug])} />
          <span>
            {kindOf(project.type)}
            {project.period ? ` · ${project.period}` : ""}
          </span>
        </p>
        <h3
          id={`${id}-h`}
          style={{ "--word": Math.max(...project.name.split(" ").map((w) => w.length)) } as CSSProperties}
          className="scene-title font-semibold text-text"
        >
          <ViewTransition name={`title-${project.slug}`} share="morph" default="none">
            <span className="inline-block">{project.name}</span>
          </ViewTransition>
        </h3>
        <p className="scene-outcome text-lg text-text">{scene.outcome}</p>
        <ul className="scene-proof" aria-label="Proof points">
          {scene.proof.map((p) => (
            <li key={p} className="flex gap-2.5">
              <span aria-hidden="true" className="text-accent">
                ▸
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <div className="scene-meta">
          <ProjectStatus project={project} />
          <ul className="flex flex-wrap gap-1.5" aria-label="Stack">
            {project.stack.slice(0, MAX_CHIPS).map((s) => (
              <li key={s}>
                <Chip>{s}</Chip>
              </li>
            ))}
            {extra > 0 ? (
              <li>
                <Chip>+{extra}</Chip>
              </li>
            ) : null}
          </ul>
        </div>
        <div className="scene-actions">
          <ProjectLinks project={project} className="flex flex-wrap items-center gap-x-5 gap-y-2" />
          {isTour && project.live ? (
            <button
              type="button"
              data-live-launch={project.live}
              className="inline-flex h-9 items-center gap-2 rounded-sm border border-accent px-3.5 font-mono text-sm text-accent transition-colors hover:bg-accent hover:text-bg pointer-coarse:h-11"
            >
              Launch live demo <span aria-hidden="true">▶</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="scene-media">
        {/* A phone card's media: one clip or still, tap to open full screen. */}
        <div className="scene-hero stage-grid" data-cursor="open">
          <Framed scene={scene} project={project} openable={openable}>
            <Content media={scene.hero} />
          </Framed>
          {openable && scene.frame === "phone" ? <Expand slug={project.slug} name={project.name} /> : null}
        </div>

        {/* A desktop's media: the frame with one layer per beat, and the beat captions under it. */}
        <div className="scene-beats">
          <ViewTransition name={`media-${project.slug}`} share="morph" default="none">
            <div className="frame-wrap stage-grid">
              <Framed scene={scene} project={project} openable={openable}>
                {scene.beats.map((b, j) => (
                  <div key={b.id} data-beat={j} data-active={j === 0 ? "" : undefined} className="beat">
                    <Content media={b.media} priority={index === 0 && j === 0} />
                  </div>
                ))}
                {isTour && project.live ? (
                  <div data-live-slot hidden className="absolute inset-0 z-10 bg-bg" />
                ) : null}
              </Framed>
              {openable && scene.frame === "phone" ? (
                <Expand slug={project.slug} name={project.name} />
              ) : null}
            </div>
          </ViewTransition>
          <ol className="beat-list" aria-label={`${project.name}: what you see`}>
            {scene.beats.map((b, j) => (
              <li key={b.id} data-beat={j} data-active={j === 0 ? "" : undefined}>
                <button type="button" data-beat-go={j} aria-current={j === 0 ? "step" : undefined}>
                  <span className="beat-num" aria-hidden="true">
                    {j + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="beat-label">{b.label}</span>
                    <span className="beat-caption">{b.caption}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {scene.illustrationNote ? <p className="beat-note">{scene.illustrationNote}</p> : null}
        </div>
      </div>
    </article>
  );
}
