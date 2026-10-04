import type { CSSProperties, ReactNode } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { profile } from "@/content/profile";
import { branchName, buildGraph, commitId, educationTag, type GraphRow } from "@/lib/content/history";
import { monogram } from "@/lib/content/monogram";
import { GraphReveal } from "./GraphReveal";

type Vars = CSSProperties & Record<`--${string}`, string | number>;

const ACCENT = "var(--accent)";
const BRANCH = "var(--grid-2)";
const MAIN = "var(--border-2)";

/**
 * Experience as a git history. Each role is a branch: a finished one merges into main at its end
 * date and forks off at its start date, an open one is a live head. Education is tagged on main.
 * The graph is decorative; the semantics are an ordered list of roles with their dates, and every
 * line of the graph is derived from content/profile.ts (hashes from the text, lanes from the dates).
 */
export function Experience() {
  const { experience, education } = profile;
  const { rows, lanes } = buildGraph(experience);
  const tagTop = education[0];
  const tagsBelow = education.slice(1);
  const total = rows.length + 1 + tagsBelow.length;
  const delay = (i: number) => `${Math.round((i * 640) / total)}ms`;
  const laneColor = (role: number) => (experience[role]!.current ? ACCENT : BRANCH);

  const rowVars = (i: number): Vars => ({ "--L": lanes, "--d": delay(i) });
  const at = (k: number, color: string): Vars => ({ "--k": k, "--c": color });

  const gutter = (children: ReactNode) => (
    <div aria-hidden="true" className="git-gutter">
      {children}
    </div>
  );
  const main = (mode?: "head" | "node") => (
    <span
      className="g-at g-line"
      data-from={mode === "head" ? "head" : undefined}
      data-to={mode === "node" ? "node" : undefined}
      style={at(0, MAIN)}
    />
  );

  const eventRow = (row: GraphRow, i: number) => {
    const color = laneColor(row.role);
    const x = (k: number) => k * 100 + 50;
    // Merge: main → branch, going down. Fork: branch → main, going down.
    const d =
      row.kind === "merge"
        ? `M${x(0)} 20 C${x(0)} 34 ${x(row.lane)} 26 ${x(row.lane)} 40`
        : `M${x(row.lane)} 0 C${x(row.lane)} 14 ${x(0)} 6 ${x(0)} 20`;
    return (
      <li
        key={`${row.kind}-${row.role}`}
        aria-hidden="true"
        className="git-row git-ev g-ev"
        style={rowVars(i)}
      >
        {gutter(
          <>
            {main()}
            {row.through.map((t) => (
              <span key={t.lane} className="g-at g-line" style={at(t.lane, laneColor(t.role))} />
            ))}
            {row.kind === "open" ? (
              <>
                <span className="g-at g-line" data-from="mid" style={at(row.lane, color)} />
                <span className="g-at g-node animate-pulse-dot rounded-pill" style={at(row.lane, color)} />
              </>
            ) : (
              <>
                <svg className="g-curve" viewBox={`0 0 ${lanes * 100} 40`} preserveAspectRatio="none">
                  <path d={d} style={{ stroke: color }} pathLength={1} />
                </svg>
                <span className="g-at g-node" style={at(0, MAIN)} />
              </>
            )}
          </>,
        )}
      </li>
    );
  };

  const blockRow = (row: GraphRow, i: number) => {
    const job = experience[row.role]!;
    const color = laneColor(row.role);
    const [first, ...rest] = job.points;
    const commit = (text: string) => (
      <li
        key={text}
        className="g-commit flex gap-2.5 text-[15px] leading-relaxed text-muted"
        style={at(row.lane, color)}
      >
        <code className="shrink-0 pt-px font-mono text-xs text-accent">{commitId(text)}</code>
        <span>{text}</span>
      </li>
    );
    return (
      <li key={`block-${row.role}`} className="git-row" style={rowVars(i)}>
        {gutter(
          <>
            {main()}
            {row.through.map((t) => (
              <span key={t.lane} className="g-at g-line" style={at(t.lane, laneColor(t.role))} />
            ))}
            <span className="g-at g-line" style={at(row.lane, color)} />
          </>,
        )}
        <div className="git-body py-4 md:py-5">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              data-monogram={monogram(job.company)}
              className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-sm border font-mono text-xs font-medium text-text"
              style={{ borderColor: color }}
            >
              {monogram(job.company)}
            </span>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-text">{job.role}</h3>
              <p className="text-muted">{job.company}</p>
            </div>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-xs text-muted">
            <span>{job.period}</span>
            {job.current ? <span className="text-accent">current</span> : null}
            <span aria-hidden="true">·</span>
            <code data-branch className="text-muted">
              {branchName(job.company)}
            </code>
          </p>
          <ul className="mt-3 max-w-[68ch] space-y-2.5">{first ? commit(first) : null}</ul>
          {rest.length > 0 ? (
            <details className="exp-details group mt-2.5">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm font-mono text-sm text-link select-none marker:hidden pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="transition-transform duration-200 group-open:rotate-90">
                  ›
                </span>
                <span className="group-open:hidden">Show details</span>
                <span className="hidden group-open:inline">Hide details</span>
              </summary>
              <ul className="mt-2.5 max-w-[68ch] space-y-2.5">{rest.map(commit)}</ul>
            </details>
          ) : null}
        </div>
      </li>
    );
  };

  const tagRow = (e: (typeof education)[number], i: number, where: "head" | "root") => (
    <li key={`tag-${e.degree}`} className="git-row" style={rowVars(i)}>
      {gutter(
        <>
          {main(where === "head" ? "head" : "node")}
          <span className="g-at g-node" data-hollow="" style={at(0, MAIN)} />
        </>,
      )}
      <div className="git-body py-1.5">
        <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <code className="rounded-sm border border-border-2 px-1.5 py-px font-mono text-xs text-text">
            tag: {educationTag(e)}
          </code>
          <span className="font-medium text-text">{e.degree}</span>
        </p>
        <p className="mt-1 font-mono text-xs text-muted">
          {e.school} · {e.period} · <span className="text-text">{e.note}</span>
        </p>
      </div>
    </li>
  );

  return (
    <section id="experience" aria-labelledby="exp-label" className="container-page section-y">
      <SectionHeader
        prefix="//"
        label="Experience"
        id="exp-label"
        title="Where I've shipped"
        ask="Walk me through his experience."
      />

      <p className="mb-5 overflow-x-auto font-mono text-sm whitespace-nowrap text-muted" aria-hidden="true">
        <span className="text-accent">$</span> git log --graph --oneline career
      </p>

      <GraphReveal>
        <ol className="git" style={{ "--L": lanes } as Vars} aria-label="Career history, newest first">
          {tagTop ? tagRow(tagTop, 0, "head") : null}
          {rows.map((row, n) => (row.kind === "block" ? blockRow(row, n + 1) : eventRow(row, n + 1)))}
          {tagsBelow.map((e, n) => tagRow(e, rows.length + 1 + n, "root"))}
        </ol>
      </GraphReveal>
    </section>
  );
}
