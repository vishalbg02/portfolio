import { sceneList } from "@/content/scenes";
import { profile } from "@/content/profile";
import { viewerItems } from "./viewer-items";
import { Scene } from "./Scene";
import { ShowcaseController } from "./ShowcaseController";

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
