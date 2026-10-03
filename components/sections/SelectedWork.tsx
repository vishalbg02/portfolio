import Link from "next/link";
import { profile } from "@/content/profile";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ProjectCard } from "@/components/work/ProjectCard";

/** Home: the four products as cards (2×2 on desktop). */
export function SelectedWork() {
  return (
    <section id="work" aria-labelledby="work-label" className="container-page section-y">
      <SectionHeader prefix="{ }" label="Work" id="work-label" title="Selected work" />
      <ul className="grid gap-4 md:grid-cols-2">
        {profile.projects.map((p) => (
          <li key={p.slug}>
            <ProjectCard project={p} />
          </li>
        ))}
      </ul>
      <p className="mt-8">
        <Link href="/work" className="font-mono text-sm text-link underline-offset-4 hover:underline">
          All projects <span aria-hidden="true">→</span>
        </Link>
      </p>
    </section>
  );
}
