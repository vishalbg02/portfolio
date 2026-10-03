import Link from "next/link";
import { Chip } from "@/components/ui/Chip";
import type { Project } from "@/lib/content/profile-schema";
import { shipped } from "@/lib/site";
import { cn } from "@/lib/utils/cn";
import { identityBg } from "./identity";
import { ProjectStatus } from "./ProjectStatus";
import { Sketch } from "./Sketch";

const MAX_CHIPS = 5;
const action =
  "relative z-10 inline-flex items-center gap-1 rounded-sm font-mono text-sm text-link underline-offset-4 hover:underline";

export function ProjectCard({
  project,
  showSummary = false,
  headingLevel = "h3",
}: {
  project: Project;
  showSummary?: boolean;
  /** Keep heading order valid: h2 on pages whose title is an h1, h3 under a section h2. */
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const href = `/work/${project.slug}`;
  const extra = project.stack.length - MAX_CHIPS;

  return (
    <article
      data-project={project.slug}
      className={cn(
        "group relative flex h-full flex-col rounded-card border border-border bg-surface p-5",
        "transition-[border-color,transform] duration-200 ease-out",
        "focus-within:border-border-2 hover:-translate-y-0.5 hover:border-border-2",
      )}
    >
      <Sketch slug={project.slug} />

      <div className="mt-5">
        <ProjectStatus project={project} />
        <Heading className="mt-3 flex items-center gap-2 text-xl font-semibold text-text">
          <span
            aria-hidden="true"
            className={cn("size-2.5 shrink-0 rounded-pill", identityBg[project.slug])}
          />
          {shipped.caseStudies ? (
            <Link href={href} className="after:absolute after:inset-0 after:content-['']">
              {project.name}
            </Link>
          ) : (
            project.name
          )}
        </Heading>
        <p className="mt-1 text-muted">{project.tagline}</p>
        <p className="mt-1 font-mono text-xs text-muted">{project.type}</p>
      </div>

      {showSummary ? <p className="mt-4 text-sm text-text">{project.summary}</p> : null}

      <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Stack">
        {project.stack.slice(0, MAX_CHIPS).map((s) => (
          <li key={s}>
            <Chip>{s}</Chip>
          </li>
        ))}
        {extra > 0 ? (
          <li>
            <Chip>+{extra}</Chip>
          </li>
        ) : null}
      </ul>

      <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-5">
        {shipped.caseStudies ? (
          <Link href={href} className={action}>
            Case study <span aria-hidden="true">→</span>
          </Link>
        ) : null}
        {project.live ? (
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
        {project.repo ? (
          <a href={project.repo} target="_blank" rel="noopener noreferrer" className={action}>
            Code <span aria-hidden="true">↗</span>
            <span className="sr-only"> ({project.name} repository, opens in a new tab)</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}
