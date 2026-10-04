import { z } from "zod";
import { ProjectSlugSchema } from "./profile-schema";

/**
 * Schema for content/media.ts: the real product captures (stills and short clips) that the Work scenes,
 * story cards and case-study galleries show. Alt text is required for every asset, and it must describe
 * only what is visible in the capture (a unit test checks the files exist and the clips fit the budget).
 */
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const alt = z.string().trim().min(20).max(240);

export const MediaStillSchema = z.object({
  id,
  slug: ProjectSlugSchema,
  kind: z.literal("still"),
  /** Which code-drawn frame wraps it: browser chrome for web captures, a phone bezel for app screens. */
  frame: z.enum(["browser", "phone"]),
  /** Size in CSS px of the 1× file; the 2× file is exactly double. */
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt,
  /** The scene beat this still belongs to (see content/work beats); used for captions only. */
  beat: z.string().trim().min(1).optional(),
  /** Where it was captured from: a public URL. Never a logged-in page. */
  source: z.url({ protocol: /^https?$/ }),
});
export type MediaStill = z.infer<typeof MediaStillSchema>;

export const MediaClipSchema = z.object({
  id,
  slug: ProjectSlugSchema,
  kind: z.literal("clip"),
  frame: z.enum(["browser", "phone"]),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt,
  source: z.url({ protocol: /^https?$/ }),
});
export type MediaClip = z.infer<typeof MediaClipSchema>;

export const MediaAssetSchema = z.discriminatedUnion("kind", [MediaStillSchema, MediaClipSchema]);
export type MediaAsset = z.infer<typeof MediaAssetSchema>;

export const MediaManifestSchema = z.array(MediaAssetSchema).superRefine((all, ctx) => {
  const seen = new Set<string>();
  all.forEach((a, i) => {
    if (seen.has(a.id)) ctx.addIssue({ code: "custom", path: [i, "id"], message: `duplicate id ${a.id}` });
    seen.add(a.id);
  });
});
