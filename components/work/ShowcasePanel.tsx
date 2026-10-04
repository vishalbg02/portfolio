import { Chip } from "@/components/ui/Chip";
import type { Project } from "@/lib/content/profile-schema";
import { cn } from "@/lib/utils/cn";
import { identityBg } from "./identity";
import { ProjectLinks } from "./ProjectLinks";
import { ProjectStatus } from "./ProjectStatus";
import { Sketch } from "./Sketch";
import { Tilt } from "./Tilt";

const MAX_CHIPS = 6;

/** One project on the stage: a terminal-style title bar, the big code-drawn sketch, and the facts. */
export function ShowcasePanel({ project, index }: { project: Project; index: number }) {
  const extra = project.stack.length - MAX_CHIPS;
  return (
    <article
      data-project={project.slug}
      className="flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 font-mono text-xs text-muted">
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={cn("size-2.5 shrink-0 rounded-pill", identityBg[project.slug])}
          />
          <span className="truncate">~/work/{project.slug}</span>
        </span>
        <span className="shrink-0 whitespace-nowrap">
          <ProjectStatus project={project} bare />
        </span>
      </div>

      <div className="stage-grid relative border-b border-border p-4 sm:p-6 lg:px-8 lg:py-6">
        <span data-c="tl" aria-hidden="true" className="stage-corner" />
        <span data-c="tr" aria-hidden="true" className="stage-corner" />
        <span data-c="bl" aria-hidden="true" className="stage-corner" />
        <span data-c="br" aria-hidden="true" className="stage-corner" />
        <div className="mx-auto max-w-[560px]">
          <Tilt>
            <Sketch slug={project.slug} />
          </Tilt>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-8">
          <div className="space-y-3">
            <div className="flex flex-col items-start gap-1 sm:flex-row sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <h3 className="text-xl font-semibold text-text sm:text-2xl">
                  <span aria-hidden="true" className="mr-2 font-mono text-sm text-accent">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {project.name}
                </h3>
                <p className="mt-1 text-muted">{project.tagline}</p>
              </div>
              {project.period ? (
                <p className="shrink-0 font-mono text-xs text-muted sm:pt-1.5">{project.period}</p>
              ) : null}
            </div>
            <p className="font-mono text-xs text-muted">{project.type}</p>
            <p className="text-sm text-text">{project.summary}</p>
          </div>
          <div className="space-y-4">
            <ul className="space-y-1.5 text-sm text-muted">
              {project.highlights.slice(0, 2).map((h) => (
                <li key={h} className="flex gap-2">
                  <span aria-hidden="true" className="text-accent">
                    ▸
                  </span>
                  <span className="line-clamp-3 lg:line-clamp-none">{h}</span>
                </li>
              ))}
            </ul>
            <ul className="flex flex-wrap gap-1.5" aria-label="Stack">
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
          </div>
        </div>
        <ProjectLinks
          project={project}
          className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4"
        />
      </div>
    </article>
  );
}
