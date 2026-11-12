import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import { getBaseMdxComponents } from "@/components/mdx/components";
import { JsonLd } from "@/components/seo/JsonLd";
import { Chip } from "@/components/ui/Chip";
import { adjacentPosts, getAllPosts, getPost } from "@/lib/content/log";
import { postJsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { formatIsoDate } from "@/lib/utils/format-date";

export async function generateStaticParams() {
  return (await getAllPosts()).map((p) => ({ slug: p.frontmatter.slug }));
}

export async function generateMetadata({ params }: PageProps<"/log/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  const { title, description, date, updated, tags, draft } = post.frontmatter;
  const base = pageMetadata({ title, description, path: `/log/${slug}` });
  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      type: "article",
      publishedTime: date,
      ...(updated ? { modifiedTime: updated } : {}),
      tags,
    },
    ...(draft ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function PostPage({ params }: PageProps<"/log/[slug]">) {
  const { slug } = await params;
  const posts = await getAllPosts();
  const post = posts.find((p) => p.frontmatter.slug === slug);
  if (!post) notFound();
  const { newer, older } = adjacentPosts(posts, slug);
  const f = post.frontmatter;

  const { content } = await compileMDX({
    source: post.body,
    components: getBaseMdxComponents(),
    options: { blockJS: true },
  });

  return (
    <article className="container-page py-10 md:py-16">
      <JsonLd data={postJsonLd(f)} />
      <Link href="/log" className="tap-slop font-mono text-sm text-muted transition-colors hover:text-text">
        <span aria-hidden="true">←</span> Ship Log
      </Link>

      <header className="mt-8 max-w-3xl">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted">
          <time dateTime={f.date}>{formatIsoDate(f.date)}</time>
          <span aria-hidden="true">·</span>
          <span>{post.minutes} min read</span>
          {f.updated ? (
            <>
              <span aria-hidden="true">·</span>
              <span>
                updated <time dateTime={f.updated}>{formatIsoDate(f.updated)}</time>
              </span>
            </>
          ) : null}
          {f.draft ? <Chip className="border-warning text-warning">Draft — hidden in production</Chip> : null}
        </p>
        <h1 className="page-title mt-3">{f.title}</h1>
        <p className="mt-3 text-lg text-muted md:text-xl">{f.description}</p>
        <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Tags">
          {f.tags.map((t) => (
            <li key={t}>
              <Chip>{t}</Chip>
            </li>
          ))}
        </ul>
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="max-w-3xl min-w-0">{content}</div>
        {post.toc.length > 0 ? (
          <nav
            aria-label="Table of contents"
            className="order-first lg:sticky lg:top-24 lg:order-none lg:self-start"
          >
            <p className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">On this page</p>
            <ol className="mt-3 space-y-2 border-l border-border text-sm">
              {post.toc.map((t) => (
                <li key={t.id} className={t.level === 3 ? "pl-7" : "pl-4"}>
                  <a href={`#${t.id}`} className="text-muted transition-colors hover:text-text">
                    {t.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
      </div>

      {newer || older ? (
        <nav aria-label="More posts" className="mt-20 grid gap-4 border-t border-border pt-10 sm:grid-cols-2">
          {[
            { label: "Newer", p: newer, align: "text-left" },
            { label: "Older", p: older, align: "sm:text-right" },
          ].map(({ label, p, align }) =>
            p ? (
              <Link
                key={label}
                href={`/log/${p.frontmatter.slug}`}
                className={`group rounded-card border border-border bg-surface p-5 transition-colors hover:border-border-2 ${align}`}
              >
                <span className="font-mono text-xs text-muted">{label} post</span>
                <span className="mt-2 block text-lg font-semibold">{p.frontmatter.title}</span>
              </Link>
            ) : (
              <span key={label} aria-hidden="true" />
            ),
          )}
        </nav>
      ) : null}
    </article>
  );
}
