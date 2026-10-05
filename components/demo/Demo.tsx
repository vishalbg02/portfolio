import type { ProjectSlug } from "@/lib/content/profile-schema";
import { mediaById } from "@/content/media";
import { profile } from "@/content/profile";
import { LiveSite } from "@/components/work/LiveSite";
import { Sketch } from "@/components/work/Sketch";
import { MediaStill } from "@/components/work/stage/Media";
import type { MediaStill as Still } from "@/lib/content/media-schema";
import { GoldenVerdictDemo } from "./demos/GoldenVerdictDemo";
import { LanSymphonyDemo } from "./demos/LanSymphonyDemo";
import { TalnioDemo } from "./demos/TalnioDemo";

/**
 * The demo for a case study (<Demo /> in the MDX). Projects with a live site get it through `LiveSite` (the real site
 * in a frame when it allows that, its real captures otherwise); Golden Verdict also keeps its walkthrough of the
 * private dashboards, drawn in code.
 */
export function Demo({ slug }: { slug: ProjectSlug }) {
  const project = profile.projects.find((p) => p.slug === slug)!;
  switch (slug) {
    case "golden-verdict":
      return (
        <>
          <LiveSite slug={slug} src={project.live!} name={project.name}>
            <MediaStill
              asset={mediaById("gv-home-desktop") as Still}
              sizes="(min-width: 1024px) 720px, 92vw"
            />
          </LiveSite>
          <GoldenVerdictDemo live={project.live!} />
        </>
      );
    case "talnio":
      return <TalnioDemo store={project.store} />;
    case "lansymphony":
      return <LanSymphonyDemo />;
    case "virtual-tour":
      return (
        <LiveSite slug={slug} src={project.live!} name={project.name}>
          <div className="stage-grid grid size-full place-items-center p-4 pb-20">
            <div className="w-full max-w-[420px]">
              <Sketch slug="virtual-tour" />
            </div>
          </div>
        </LiveSite>
      );
  }
}
