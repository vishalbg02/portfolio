import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import { profile } from "@/content/profile";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { getMdxComponents } from "@/components/mdx/components";
import { identityBg } from "@/components/work/identity";
import { ProjectStatus } from "@/components/work/ProjectStatus";
import { Sketch } from "@/components/work/Sketch";
import { getAdjacentProjects, getAllCaseStudySlugs, getCaseStudy } from "@/lib/content/work";
import { JsonLd } from "@/components/seo/JsonLd";
import { projectJsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { cn } from "@/lib/utils/cn";

export function generateStaticParams() {
  return getAllCaseStudySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/work/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const study = await getCaseStudy(slug);
  const project = profile.projects.find((p) => p.slug === slug);
  if (!study || !project) return {};
  return pageMetadata({
    title: `${project.name} — case study`,
    description: study.frontmatter.description,
    path: `/work/${slug}`,
  });
}

function Glance({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 p-4 md:p-5">
      <dt className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">{label}</dt>
      <dd className="mt-1.5 text-sm text-text">{children}</dd>
    </div>
  );
}

export default async function CaseStudyPage({ params }: PageProps<"/work/[slug]">) {
  const { slug } = await params;
  const [study, project] = [await getCaseStudy(slug), profile.projects.find((p) => p.slug === slug)];
  const adjacent = getAdjacentProjects(slug);
  if (!study || !project || !adjacent) notFound();

  const { content } = await compileMDX({
    source: study.body,
    components: getMdxComponents(project.slug),
    options: { blockJS: true },
  });

  const { glance } = study.frontmatter;
  const stackShown = project.stack.slice(0, 4);
  const stackExtra = project.stack.length - stackShown.length;

  return (
    <article className="container-page py-10 md:py-16">
      <JsonLd data={projectJsonLd(project, study.frontmatter.description)} />
      <Link href="/work" className="font-mono text-sm text-muted transition-colors hover:text-text">
        <span aria-hidden="true">←</span> All work
      </Link>

      <header className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-center">
        <div>
          <p className="flex items-center gap-2 font-mono text-xs text-muted">
            <span aria-hidden="true" className={cn("size-2.5 rounded-pill", identityBg[project.slug])} />
            {project.type}
            {project.period ? <span> · {project.period}</span> : null}
          </p>
          <h1 className="mt-3 text-3xl font-semibold md:text-5xl">{project.name}</h1>
          <p className="mt-3 max-w-xl text-lg text-muted md:text-xl">{project.tagline}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <ProjectStatus project={project} />
            {project.live ? (
              <ButtonLink href={project.live} external variant="solid" size="sm">
                Live site <span aria-hidden="true">↗</span>
              </ButtonLink>
            ) : null}
            {project.store ? (
              <ButtonLink href={project.store} external variant="solid" size="sm">
                Google Play <span aria-hidden="true">↗</span>
              </ButtonLink>
            ) : null}
            {project.repo ? (
              <ButtonLink href={project.repo} external variant="ghost" size="sm">
                Code <span aria-hidden="true">↗</span>
              </ButtonLink>
            ) : null}
          </div>

          <ul className="mt-6 flex flex-wrap gap-1.5" aria-label="Stack">
            {project.stack.map((s) => (
              <li key={s}>
                <Chip>{s}</Chip>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-card border border-border bg-surface p-3">
          <Sketch slug={project.slug} />
        </div>
      </header>

      <dl className="mt-10 grid overflow-hidden rounded-card border border-border bg-surface sm:grid-cols-2 lg:grid-cols-4 [&>div]:border-border lg:[&>div]:border-t-0 [&>div:not(:first-child)]:border-t lg:[&>div:not(:first-child)]:border-l sm:[&>div:nth-child(2)]:border-t-0 sm:[&>div:nth-child(even)]:border-l">
        <Glance label="Role">{glance.role}</Glance>
        <Glance label="Platform">{glance.platform}</Glance>
        <Glance label="Stack">
          {stackShown.join(" · ")}
          {stackExtra > 0 ? <span className="text-muted"> +{stackExtra}</span> : null}
        </Glance>
        <Glance label="Status">{glance.status}</Glance>
      </dl>

      <div className="mt-14 max-w-4xl">{content}</div>

      <nav
        aria-label="More projects"
        className="mt-20 grid gap-4 border-t border-border pt-10 sm:grid-cols-2"
      >
        {[
          { dir: "Previous", p: adjacent.prev, align: "text-left" },
          { dir: "Next", p: adjacent.next, align: "sm:text-right" },
        ].map(({ dir, p, align }) => (
          <Link
            key={dir}
            href={`/work/${p.slug}`}
            className={cn(
              "group rounded-card border border-border bg-surface p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-border-2",
              align,
            )}
          >
            <span className="font-mono text-xs text-muted">
              {dir === "Previous" ? "← " : ""}
              {dir} project{dir === "Next" ? " →" : ""}
            </span>
            <span
              className={cn(
                "mt-2 flex items-center gap-2 text-lg font-semibold",
                dir === "Next" && "sm:justify-end",
              )}
            >
              <span aria-hidden="true" className={cn("size-2.5 rounded-pill", identityBg[p.slug])} />
              {p.name}
            </span>
            <span className="mt-1 block text-sm text-muted">{p.tagline}</span>
          </Link>
        ))}
      </nav>
    </article>
  );
}
