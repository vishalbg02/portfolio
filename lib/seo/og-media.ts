import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { mediaById } from "@/content/media";
import { sceneFor } from "@/content/scenes";
import { clipSources, stillSources } from "@/lib/media/paths";

/**
 * The real capture for a case study's social card: the same hero picture the Work section shows (a still, or a clip's
 * poster), re-encoded as a small JPEG data URL because the card renderer reads PNG and JPEG, not WebP or AVIF. A project
 * whose hero is a drawing (LanSymphony has no public UI) returns null and keeps the text-only card. Runs at build time.
 */
export async function ogImageFor(slug: string, width = 760): Promise<string | null> {
  const hero = sceneFor(slug)?.hero;
  if (!hero || hero.type === "illustration") return null;
  const asset = mediaById(hero.id);
  if (!asset) return null;
  const url = (asset.kind === "still" ? stillSources(asset) : clipSources(asset).poster).fallback;
  try {
    const file = await readFile(path.join(process.cwd(), "public", url));
    const jpeg = await sharp(file)
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch (err) {
    console.error("[og] could not read the capture for", slug, (err as Error).message);
    return null;
  }
}
