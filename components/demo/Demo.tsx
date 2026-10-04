import type { ProjectSlug } from "@/lib/content/profile-schema";
import { profile } from "@/content/profile";
import { GoldenVerdictDemo } from "./demos/GoldenVerdictDemo";
import { LanSymphonyDemo } from "./demos/LanSymphonyDemo";
import { TalnioDemo } from "./demos/TalnioDemo";
import { VirtualTourDemo } from "./demos/VirtualTourDemo";

/** The demo for a case study (<Demo /> in the MDX). Golden Verdict can't be embedded, so it is an illustration. */
export function Demo({ slug }: { slug: ProjectSlug }) {
  const project = profile.projects.find((p) => p.slug === slug)!;
  switch (slug) {
    case "golden-verdict":
      return <GoldenVerdictDemo live={project.live!} />;
    case "talnio":
      return <TalnioDemo store={project.store} />;
    case "lansymphony":
      return <LanSymphonyDemo />;
    case "virtual-tour":
      return <VirtualTourDemo src={project.live!} />;
  }
}
