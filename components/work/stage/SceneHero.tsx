import { ViewTransition } from "react";
import { sceneFor } from "@/content/scenes";
import type { Project } from "@/lib/content/profile-schema";
import { BrowserFrame, DiagramFrame, PhoneFrame } from "./Frames";
import { Illustration } from "./illustrations/Illustration";
import { MediaPoster, MediaStill, resolveMedia } from "./Media";

/**
 * A project's real capture in its frame, nothing moving: the card on /work and the header of a case study.
 * Its transition name matches the Work scene's frame, so opening a case study morphs the capture into place.
 */
export function SceneHero({ project, priority = false }: { project: Project; priority?: boolean }) {
  const scene = sceneFor(project.slug);
  if (!scene) return null;
  const { hero } = scene;
  const content =
    hero.type === "illustration" ? (
      <Illustration id={hero.id} />
    ) : hero.type === "clip" ? (
      <MediaPoster asset={resolveMedia(hero.id, "clip")} priority={priority} />
    ) : (
      <MediaStill asset={resolveMedia(hero.id, "still")} priority={priority} />
    );
  const frame =
    scene.frame === "phone" ? (
      <PhoneFrame maxWidth={170}>{content}</PhoneFrame>
    ) : scene.frame === "diagram" ? (
      <DiagramFrame label={scene.frameLabel}>{content}</DiagramFrame>
    ) : (
      <BrowserFrame label={scene.frameLabel}>{content}</BrowserFrame>
    );
  return (
    <ViewTransition name={`media-${project.slug}`} share="morph" default="none">
      <div className="stage-grid rounded-card border border-border p-4 sm:p-5">{frame}</div>
    </ViewTransition>
  );
}
