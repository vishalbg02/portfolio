import type { Metadata } from "next";
import { MatchTool } from "@/components/match/MatchTool";
import { ResumeView } from "@/components/resume/ResumeView";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { RESUME_FILENAME, buildResumeModel } from "@/lib/resume/model";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageJsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { resumeHref } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Résumé",
  description:
    "Vishal B G — Full Stack Developer (Java, Spring Boot, React, Next.js, SQL). Work experience, projects, skills and achievements. Download the PDF.",
  path: "/resume",
});

const formatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default function ResumePage() {
  const model = buildResumeModel();
  return (
    <div className="container-page py-12 md:py-20">
      <JsonLd
        data={pageJsonLd("Résumé", "/resume", [
          { name: "Home", path: "/" },
          { name: "Résumé", path: "/resume" },
        ])}
      />
      <SectionHeader prefix="#" label="Résumé" id="resume-label" />
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold md:text-4xl">{model.name}</h1>
          <p className="mt-2 max-w-2xl text-muted">{model.subtitle}</p>
          <p className="mt-3 font-mono text-xs text-muted">
            Last updated <time dateTime={model.updatedAt}>{formatter.format(new Date(model.updatedAt))}</time>
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink
            href={resumeHref}
            variant="solid"
            download={RESUME_FILENAME}
            data-track="resume_download"
          >
            Download PDF
          </ButtonLink>
          <ButtonLink href="/#contact" variant="ghost">
            Contact
          </ButtonLink>
        </div>
      </div>
      <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-1 font-mono text-sm" aria-label="Contact">
        {model.contact.map((c) => (
          <li key={c.text}>
            {c.href ? (
              <a href={c.href} className="text-link underline-offset-4 hover:underline">
                {c.text}
              </a>
            ) : (
              <span className="text-muted">{c.text}</span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <ResumeView model={model} />
      </div>

      <section id="match" aria-labelledby="match-label" className="mt-16">
        <SectionHeader prefix="=" label="Match" id="match-label" title="Does this résumé fit your role?" />
        <p className="mb-5 max-w-2xl text-muted">
          Paste a job description to see which requirements Vishal&apos;s work supports, with evidence — and
          which it doesn&apos;t.
        </p>
        <MatchTool />
      </section>
    </div>
  );
}
