import { sceneList } from "@/content/scenes";
import { mediaFor } from "@/content/media";
import { profile } from "@/content/profile";
import { stillSources } from "@/lib/media/paths";
import type { ViewerItem } from "./viewer-types";
import { Scene } from "./Scene";
import { ShowcaseController } from "./ShowcaseController";

/** The items the full-screen viewer shows for a project: the stills its beats use first, then the rest. */
function viewerItems(slug: string): ViewerItem[] {
  const scene = sceneList.find((s) => s.slug === slug)!;
  const ordered = [
    ...scene.beats.flatMap((b) => (b.media.type === "still" ? [b.media.id] : [])),
    ...mediaFor(scene.slug)
      .filter((m) => m.kind === "still")
      .map((m) => m.id),
  ];
  const caption = new Map(
    scene.beats.flatMap((b) => (b.media.type === "still" ? [[b.media.id, b.label] as const] : [])),
  );
  return [...new Set(ordered)].flatMap((id) => {
    const m = mediaFor(scene.slug).find((x) => x.id === id);
    if (!m || m.kind !== "still") return [];
    const s = stillSources(m);
    return [
      {
        id: m.id,
        alt: m.alt,
        caption: caption.get(m.id) ?? null,
        frame: m.frame,
        avifSet: s.avifSet,
        webpSet: s.webpSet,
        src: s.fallback,
        width: m.width,
        height: m.height,
      },
    ];
  });
}

/**
 * The Work section's stage: every project as a scene (copy, proof, status, links, and its captures in a
 * code-drawn frame). All markup is server-rendered; ShowcaseController only moves between scenes and beats.
 */
export function WorkShowcase() {
  const items = sceneList.map((scene, i) => ({
    scene,
    project: profile.projects.find((p) => p.slug === scene.slug)!,
    index: i,
    viewer: viewerItems(scene.slug),
  }));
  return (
    <ShowcaseController
      scenes={items.map((i) => ({
        slug: i.project.slug,
        name: i.project.name,
        beats: i.scene.beats.length,
        beatItem: i.scene.beats.map((b) =>
          b.media.type === "still" ? i.viewer.findIndex((v) => v.id === (b.media as { id: string }).id) : -1,
        ),
      }))}
      viewer={Object.fromEntries(items.map((i) => [i.project.slug, i.viewer]))}
    >
      {items.map((i) => (
        <Scene
          key={i.project.slug}
          scene={i.scene}
          project={i.project}
          index={i.index}
          openable={i.viewer.length > 0}
        />
      ))}
    </ShowcaseController>
  );
}
