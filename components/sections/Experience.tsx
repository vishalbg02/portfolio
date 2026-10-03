import { SectionHeader } from "@/components/ui/SectionHeader";
import { profile } from "@/content/profile";
import { cn } from "@/lib/utils/cn";

/**
 * Vertical timeline: mono dates on the left, content on the right, a pulsing node for the current
 * role. "Show details" is a native <details>, so it works without JS; the height animation is
 * pure CSS (see `.exp-details` in globals.css) and falls back to an instant toggle.
 */
export function Experience() {
  return (
    <section id="experience" aria-labelledby="exp-label" className="container-page section-y">
      <SectionHeader prefix="//" label="Experience" id="exp-label" title="Where I've shipped" />

      <ol className="relative">
        {profile.experience.map((job) => {
          const [first, ...rest] = job.points;
          return (
            <li
              key={job.role + job.company}
              className="relative grid gap-x-8 gap-y-2 pb-10 pl-7 last:pb-0 md:grid-cols-[170px_1fr] md:pl-0"
            >
              {/* timeline rail + node */}
              <span
                aria-hidden="true"
                className="absolute top-2 bottom-0 left-[5px] w-px bg-border md:left-[178px] md:translate-x-0"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-[7px] left-0 size-[11px] rounded-pill border-2 md:left-[173px]",
                  job.current ? "animate-pulse-dot border-accent bg-accent" : "border-border-2 bg-bg",
                )}
              />

              <p className="font-mono text-sm text-muted md:w-[170px] md:pt-0.5 md:pr-10 md:text-right">
                {job.period}
                {job.current ? <span className="mt-1 block text-xs text-accent">current</span> : null}
              </p>

              <div className="md:pl-6">
                <h3 className="text-lg font-semibold text-text">{job.role}</h3>
                <p className="text-muted">{job.company}</p>
                <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-muted">{first}</p>

                {rest.length > 0 ? (
                  <details className="exp-details group mt-3">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm font-mono text-sm text-link select-none marker:hidden [&::-webkit-details-marker]:hidden">
                      <span
                        aria-hidden="true"
                        className="transition-transform duration-200 group-open:rotate-90"
                      >
                        ›
                      </span>
                      <span className="group-open:hidden">Show details</span>
                      <span className="hidden group-open:inline">Hide details</span>
                    </summary>
                    <ul className="mt-3 max-w-[68ch] space-y-2.5 text-[15px] leading-relaxed text-muted">
                      {rest.map((p) => (
                        <li key={p} className="flex gap-2.5">
                          <span aria-hidden="true" className="text-accent">
                            ›
                          </span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-12 border-t border-border pt-8">
        <h3 className="mb-4 font-mono text-xs tracking-[0.12em] text-muted uppercase">Education</h3>
        <ul className="grid gap-3 md:grid-cols-2">
          {profile.education.map((e) => (
            <li key={e.degree} className="rounded-card border border-border bg-surface p-4">
              <p className="font-medium text-text">{e.degree}</p>
              <p className="text-sm text-muted">{e.school}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 font-mono text-xs text-muted">
                <span>{e.period}</span>
                <span aria-hidden="true">·</span>
                <span className="text-text">{e.note}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
