import type { Metadata } from "next";
import Link from "next/link";
import { MatchTool } from "@/components/match/MatchTool";
import { JsonLd } from "@/components/seo/JsonLd";
import { ButtonLink } from "@/components/ui/Button";
import { Chip, StatusDot } from "@/components/ui/Chip";
import { profile } from "@/content/profile";
import { experienceSummary } from "@/lib/match/experience";
import { RESUME_FILENAME, buildResumeModel } from "@/lib/resume/model";
import { pageJsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { resumeHref } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Recruiter mode",
  description:
    "Vishal B G at a glance: full-stack developer in Bengaluru (Java, Spring Boot, React, Next.js, SQL). Experience, shipped projects, skills and contact details on one page.",
  path: "/recruiter",
});

function Block({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title} className={className}>
      <h2 className="mb-3 border-b border-border pb-2 font-mono text-xs tracking-[0.12em] text-muted uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function RecruiterPage() {
  const resume = buildResumeModel();
  const exp = experienceSummary(profile, new Date());
  const { contact } = profile;
  const facts: Array<[string, string]> = [
    ["Role", profile.shortRole],
    ["Location", profile.location],
    ["Internships", `~${exp.years} years`],
    [
      "Education",
      `${profile.education[0]!.degree.replace(/^Master of Computer Applications \(MCA\)$/, "MCA")} (${profile.education[0]!.period})`,
    ],
    ["Hackathons", `${profile.recognition.length} podium finishes`],
  ];

  return (
    <div className="container-page py-8 md:py-12">
      <JsonLd
        data={pageJsonLd("Recruiter mode", "/recruiter", [
          { name: "Home", path: "/" },
          { name: "Recruiter mode", path: "/recruiter" },
        ])}
      />

      <header className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-xs text-muted">
            <StatusDot /> {profile.status}
          </p>
          <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{profile.name}</h1>
          <p className="mt-2 max-w-2xl text-muted">{profile.summary}</p>
          <p className="mt-3 max-w-2xl text-sm text-text">
            <span className="font-mono text-xs tracking-[0.12em] text-muted uppercase">Looking for </span>
            {profile.workPreferences.roles.join(" · ")}. {profile.workPreferences.locations};{" "}
            {profile.workPreferences.modes.join(" / ").toLowerCase()}. {profile.workPreferences.startDate}.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ButtonLink
            href={resumeHref}
            variant="solid"
            download={RESUME_FILENAME}
            data-track="resume_download"
          >
            Download résumé
          </ButtonLink>
          <ButtonLink href={`mailto:${contact.email}`} variant="outline">
            Email
          </ButtonLink>
          <ButtonLink href={contact.phoneHref} variant="ghost">
            Call
          </ButtonLink>
        </div>
      </header>

      <dl className="mt-6 grid grid-cols-2 overflow-hidden rounded-card border border-border bg-surface md:grid-cols-5 [&>div]:border-border md:[&>div]:border-t-0 md:[&>div:not(:first-child)]:border-l [&>div:not(:nth-child(-n+2))]:border-t [&>div:nth-child(even)]:border-l md:[&>div:nth-child(odd)]:border-l">
        {facts.map(([k, v]) => (
          <div key={k} className="p-3 md:p-4">
            <dt className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">{k}</dt>
            <dd className="mt-1 text-sm text-text">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <Block title="Experience">
          <div className="space-y-5">
            {resume.experience.map((e) => (
              <article key={e.org + e.role}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <h3 className="font-semibold">{e.role}</h3>
                  <p className="font-mono text-xs text-muted">{e.period}</p>
                </div>
                <p className="text-sm text-muted">{e.org}</p>
                <ul className="mt-2 space-y-1 text-[15px] leading-relaxed text-muted">
                  {e.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <span aria-hidden="true">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </Block>

        <Block title="Shipped projects">
          <ul className="space-y-4">
            {profile.projects.map((p) => (
              <li key={p.slug}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <h3 className="font-semibold">{p.name}</h3>
                  {p.period ? <p className="font-mono text-xs text-muted">{p.period}</p> : null}
                </div>
                <p className="text-sm text-muted">{p.summary}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <Link href={`/work/${p.slug}`} className="text-link underline underline-offset-4">
                    Case study
                  </Link>
                  {p.live ? (
                    <a
                      href={p.live}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-link underline underline-offset-4"
                      data-track="project_live_click"
                    >
                      Live site<span aria-hidden="true"> ↗</span>
                    </a>
                  ) : null}
                  {p.store ? (
                    <a
                      href={p.store}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-link underline underline-offset-4"
                      data-track="project_live_click"
                    >
                      Google Play<span aria-hidden="true"> ↗</span>
                    </a>
                  ) : null}
                  {p.repo ? (
                    <a
                      href={p.repo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-link underline underline-offset-4"
                    >
                      Code<span aria-hidden="true"> ↗</span>
                    </a>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        </Block>

        <Block title="Skills">
          <dl className="space-y-2 text-[15px]">
            {resume.skills
              .filter((g) => g.label !== "Spoken Languages")
              .map((g) => (
                <div key={g.label} className="grid gap-1 sm:grid-cols-[130px_minmax(0,1fr)]">
                  <dt className="font-medium text-text">{g.label}</dt>
                  <dd className="text-muted">{g.text}</dd>
                </div>
              ))}
          </dl>
        </Block>

        <Block title="Recognition">
          <ul className="space-y-2 text-[15px]">
            {profile.recognition.map((r) => (
              <li key={r.event} className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span>
                  <span className="font-medium text-text">{r.place}</span>
                  <span className="text-muted"> · {r.event}</span>
                </span>
                <span className="font-mono text-xs text-muted">{r.date}</span>
              </li>
            ))}
          </ul>
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Certifications">
            {resume.certifications.map((c) => (
              <li key={c.title}>
                <Chip>
                  {c.title} · {c.year}
                </Chip>
              </li>
            ))}
          </ul>
        </Block>
      </div>

      <section id="match" aria-labelledby="rm-match" className="mt-12">
        <h2 id="rm-match" className="mb-3 text-xl font-semibold">
          Paste your job description
        </h2>
        <p className="mb-5 max-w-2xl text-muted">
          See which requirements this work supports, with evidence, and which it doesn&apos;t.
        </p>
        <MatchTool />
      </section>

      <p className="mt-12 text-sm text-muted">
        Want the full story?{" "}
        <Link href="/" className="text-link underline underline-offset-4">
          Open the full site
        </Link>{" "}
        or the{" "}
        <Link href="/resume" className="text-link underline underline-offset-4">
          web résumé
        </Link>
        .
      </p>
    </div>
  );
}
