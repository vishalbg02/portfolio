import type { Metadata } from "next";
import { profile } from "@/content/profile";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ProjectCard } from "@/components/work/ProjectCard";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Work",
  description:
    "Four products I've shipped — a legal SaaS, a workforce platform, an offline P2P communicator and a 360° campus tour.",
  path: "/work",
});

export default function WorkPage() {
  return (
    <div className="container-page py-12 md:py-20">
      <SectionHeader prefix="{ }" label="Work" id="work-label" />
      <h1 className="text-3xl font-semibold md:text-4xl">Everything ships.</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        Four products, each built and put in front of real users. Open a case study for the architecture and
        the decisions behind it.
      </p>
      <ul className="mt-10 grid gap-4 md:grid-cols-2">
        {profile.projects.map((p) => (
          <li key={p.slug}>
            <ProjectCard project={p} showSummary headingLevel="h2" />
          </li>
        ))}
      </ul>
    </div>
  );
}
