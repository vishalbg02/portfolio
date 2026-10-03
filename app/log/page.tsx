import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { Chip } from "@/components/ui/Chip";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAllPosts } from "@/lib/content/log";
import { pageJsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { formatIsoDate } from "@/lib/utils/format-date";

const base = pageMetadata({
  title: "Ship Log",
  description:
    "Notes from building and shipping software: architecture decisions, trade-offs and what I'd do differently.",
  path: "/log",
});

export async function generateMetadata(): Promise<Metadata> {
  const posts = await getAllPosts();
  return {
    ...base,
    alternates: { ...base.alternates, types: { "application/rss+xml": "/log/rss.xml" } },
    // An empty log is not worth indexing.
    ...(posts.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function LogPage() {
  const posts = await getAllPosts();
  return (
    <div className="container-page py-12 md:py-20">
      <JsonLd
        data={pageJsonLd("Ship Log", "/log", [
          { name: "Home", path: "/" },
          { name: "Ship Log", path: "/log" },
        ])}
      />
      <SectionHeader prefix="$" label="Ship Log" id="log-label" />
      <h1 className="text-3xl font-semibold md:text-4xl">Ship Log</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        Notes from building and shipping: decisions, trade-offs and what I&apos;d change.{" "}
        <a href="/log/rss.xml" className="text-link underline underline-offset-4">
          RSS
        </a>
      </p>

      {posts.length === 0 ? (
        <p className="mt-10 rounded-card border border-border bg-surface p-6 text-muted">
          The first post is on its way. Subscribe via RSS or check back soon.
        </p>
      ) : (
        <ul className="mt-10 divide-y divide-border border-y border-border">
          {posts.map(({ frontmatter: f, minutes }) => (
            <li key={f.slug}>
              <Link
                href={`/log/${f.slug}`}
                className="group block py-6 transition-colors hover:bg-surface md:px-4"
              >
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted">
                  <time dateTime={f.date}>{formatIsoDate(f.date)}</time>
                  <span aria-hidden="true">·</span>
                  <span>{minutes} min read</span>
                  {f.draft ? <Chip className="border-warning text-warning">Draft</Chip> : null}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-text group-hover:underline">{f.title}</h2>
                <p className="mt-1 max-w-2xl text-muted">{f.description}</p>
                <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tags">
                  {f.tags.map((t) => (
                    <li key={t}>
                      <Chip>{t}</Chip>
                    </li>
                  ))}
                </ul>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
