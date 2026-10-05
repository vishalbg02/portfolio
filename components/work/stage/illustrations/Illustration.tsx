import type { IllustrationId } from "@/lib/content/scene-schema";
import { GoldenVerdictBeat } from "./GoldenVerdictBeat";
import { LanSymphonyBeat } from "./LanSymphonyBeat";

/** The code-drawn beats (Golden Verdict's private dashboards, LanSymphony's protocol). Server-rendered, no JS. */
export function Illustration({ id }: { id: IllustrationId }) {
  if (id === "gv-track") return <GoldenVerdictBeat />;
  return <LanSymphonyBeat id={id} />;
}
