import Link from "next/link";
import type { Project } from "@/lib/content/profile-schema";
import { shipped } from "@/lib/site";

const action =
  "relative z-10 inline-flex items-center gap-1 rounded-sm font-mono text-sm text-link underline-offset-4 hover:underline pointer-coarse:min-h-11";

/**
 * Case study / live site / Google Play / code links for a project. Shared by cards and the showcase (which shows its
 * own, larger "Visit live site", so it passes `live={false}`).
 */
export function ProjectLinks({
  project,
  className,
  live = true,
}: {
  project: Project;
  className?: string;
  live?: boolean;
}) {
  return (
    <div className={className}>
      {shipped.caseStudies ? (
        <Link href={`/work/${project.slug}`} className={action}>
          Case study <span aria-hidden="true">→</span>
        </Link>
      ) : null}
      {live && project.live ? (
        <a
          href={project.live}
          target="_blank"
          rel="noopener noreferrer"
          className={action}
          data-track="project_live_click"
          data-track-project={project.slug}
        >
          Live <span aria-hidden="true">↗</span>
          <span className="sr-only"> ({project.name}, opens in a new tab)</span>
        </a>
      ) : null}
      {project.store ? (
        <a href={project.store} target="_blank" rel="noopener noreferrer" className={action}>
          Google Play <span aria-hidden="true">↗</span>
          <span className="sr-only"> ({project.name} on Google Play, opens in a new tab)</span>
        </a>
      ) : null}
      {project.repo ? (
        <a href={project.repo} target="_blank" rel="noopener noreferrer" className={action}>
          Code <span aria-hidden="true">↗</span>
          <span className="sr-only"> ({project.name} repository, opens in a new tab)</span>
        </a>
      ) : null}
    </div>
  );
}
