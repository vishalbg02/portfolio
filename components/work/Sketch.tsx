import type { ProjectSlug } from "@/lib/content/profile-schema";
import { GoldenVerdictSketch } from "./visuals/GoldenVerdictSketch";
import { LanSymphonySketch } from "./visuals/LanSymphonySketch";
import { TalnioSketch } from "./visuals/TalnioSketch";
import { VirtualTourSketch } from "./visuals/VirtualTourSketch";

/** Code-drawn visual per project (no screenshots). Animates on card hover/focus only. */
export function Sketch({ slug, live }: { slug: ProjectSlug; live?: boolean }) {
  switch (slug) {
    case "golden-verdict":
      return <GoldenVerdictSketch live={live} />;
    case "talnio":
      return <TalnioSketch live={live} />;
    case "lansymphony":
      return <LanSymphonySketch live={live} />;
    case "virtual-tour":
      return <VirtualTourSketch live={live} />;
  }
}
