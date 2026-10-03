import type { ReactNode } from "react";
import { RESUME_SECTION_TITLES, type ResumeModel } from "@/lib/resume/model";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="border-t border-border py-7 first:border-t-0 first:pt-0">
      <h2 className="mb-4 text-sm font-semibold tracking-wide text-text uppercase">{title}</h2>
      {children}
    </section>
  );
}

const Row = ({ left, right }: { left: ReactNode; right: string }) => (
  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
    <div className="min-w-0 text-text">{left}</div>
    <p className="shrink-0 font-mono text-xs text-muted">{right}</p>
  </div>
);

const Bullets = ({ items }: { items: string[] }) => (
  <ul className="mt-2 space-y-1.5 text-[15px] leading-relaxed text-muted">
    {items.map((t) => (
      <li key={t} className="flex gap-2.5">
        <span aria-hidden="true" className="text-muted">
          •
        </span>
        <span>{t}</span>
      </li>
    ))}
  </ul>
);

/** HTML résumé. Same model as the PDF, so the two can never disagree. */
export function ResumeView({ model }: { model: ResumeModel }) {
  const T = RESUME_SECTION_TITLES;
  return (
    <div className="rounded-card border border-border bg-surface p-5 sm:p-8">
      <Section title={T.summary}>
        <p className="max-w-3xl text-[15px] leading-relaxed text-muted">{model.summary}</p>
      </Section>

      <Section title={T.experience}>
        <div className="space-y-6">
          {model.experience.map((e) => (
            <article key={e.org + e.role}>
              <Row left={<h3 className="font-semibold">{e.org}</h3>} right={e.period} />
              <p className="mt-0.5 text-sm text-muted italic">{e.role}</p>
              <Bullets items={e.bullets} />
            </article>
          ))}
        </div>
      </Section>

      <Section title={T.projects}>
        <div className="space-y-6">
          {model.projects.map((p) => (
            <article key={p.title}>
              <Row
                left={
                  <h3 className="font-semibold">
                    {p.title} <span className="font-normal text-muted">| {p.stack}</span>
                  </h3>
                }
                right={p.date}
              />
              <Bullets items={p.bullets} />
            </article>
          ))}
        </div>
      </Section>

      <Section title={T.skills}>
        <dl className="space-y-1.5 text-[15px]">
          {model.skills.map((g) => (
            <div key={g.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
              <dt className="w-28 shrink-0 font-semibold text-text">{g.label}</dt>
              <dd className="text-muted">{g.text}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title={T.education}>
        <div className="space-y-3">
          {model.education.map((e) => (
            <div key={e.line}>
              <Row left={<h3 className="font-semibold">{e.school}</h3>} right={e.period} />
              <p className="text-sm text-muted">{e.line}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title={T.certifications}>
        <ul className="space-y-1.5">
          {model.certifications.map((c) => (
            <li key={c.title}>
              <Row
                left={
                  <>
                    <span className="font-medium">{c.title}</span>{" "}
                    <span className="text-muted">– {c.org}</span>
                  </>
                }
                right={c.year}
              />
            </li>
          ))}
        </ul>
      </Section>

      <Section title={T.achievements}>
        <ul className="space-y-1.5">
          {model.achievements.map((a) => (
            <li key={a.title}>
              <Row
                left={
                  <>
                    <span className="font-medium">{a.title}</span>{" "}
                    <span className="text-muted">– {a.detail}</span>
                  </>
                }
                right={a.date}
              />
            </li>
          ))}
        </ul>
      </Section>

      {model.leadership.length > 0 ? (
        <Section title={T.leadership}>
          {model.leadership.map((l) => (
            <article key={l.title}>
              <Row left={<h3 className="font-semibold">{l.title}</h3>} right={l.date} />
              <p className="mt-0.5 text-sm text-muted italic">{l.role}</p>
              <Bullets items={l.bullets} />
            </article>
          ))}
        </Section>
      ) : null}
    </div>
  );
}
