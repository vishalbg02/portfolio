import { mediaFor } from "@/content/media";
import { sceneList } from "@/content/scenes";
import { stillSources } from "@/lib/media/paths";
import type { ViewerItem } from "./viewer-types";

/** The items the full-screen viewer shows for a project: the stills its beats use first, then the rest. */
export function viewerItems(slug: string): ViewerItem[] {
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
