import "./zod-csp";
import { z } from "zod";
import { ProjectSlugSchema } from "./profile-schema";

/**
 * Schema for content/scenes.ts: how each project is told in the Work showcase. A scene is a few "beats";
 * each beat shows one real capture (see content/media.ts), or a labelled code-drawn illustration where
 * the real thing is private (Golden Verdict's dashboards) or has no UI (LanSymphony).
 */
const text = z.string().trim().min(3);

export const IllustrationIdSchema = z.enum(["gv-track", "ls-discover", "ls-encrypt", "ls-calls"]);
export type IllustrationId = z.infer<typeof IllustrationIdSchema>;

const MediaRef = z.discriminatedUnion("type", [
  z.object({ type: z.literal("still"), id: text }),
  z.object({ type: z.literal("clip"), id: text }),
  z.object({ type: z.literal("illustration"), id: IllustrationIdSchema }),
]);
export type MediaRef = z.infer<typeof MediaRef>;

export const BeatSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** Short title of the beat ("Choose a service"). */
  label: text.max(32),
  /** One line saying what the visitor is looking at. */
  caption: text.max(140),
  media: MediaRef,
});
export type Beat = z.infer<typeof BeatSchema>;

export const SceneSchema = z.object({
  slug: ProjectSlugSchema,
  /** The code-drawn frame: browser chrome, phone bezel, or a plain diagram panel. */
  frame: z.enum(["browser", "phone", "diagram"]),
  /** Shown in the frame's address bar (browser) or under the frame (others). */
  frameLabel: text,
  /** One line: what it achieved. Every word must be backed by profile.ts (a unit test checks it). */
  outcome: text.max(110),
  /** Three short proof points, each backed by profile.ts (a unit test checks it). */
  proof: z.array(text.max(60)).length(3),
  /** The media a phone card shows on top (clip when there is one). */
  hero: MediaRef,
  beats: z.array(BeatSchema).min(3).max(4),
  /** Set when some beats are illustrations: said out loud under the frame. */
  illustrationNote: text.optional(),
});
export type Scene = z.infer<typeof SceneSchema>;

export const ScenesSchema = z.array(SceneSchema).superRefine((all, ctx) => {
  const seen = new Set<string>();
  all.forEach((s, i) => {
    if (seen.has(s.slug)) ctx.addIssue({ code: "custom", path: [i, "slug"], message: `duplicate ${s.slug}` });
    seen.add(s.slug);
  });
});
