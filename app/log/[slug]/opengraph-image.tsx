import { notFound } from "next/navigation";
import { getAllPosts, getPost } from "@/lib/content/log";
import { OG_SIZE, OG_TYPE, renderOg } from "@/lib/seo/og";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "Ship Log post — Vishal B G";

export async function generateStaticParams() {
  return (await getAllPosts()).map((p) => ({ slug: p.frontmatter.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  return renderOg({
    title: post.frontmatter.title,
    kicker: `Ship Log · ${post.frontmatter.tags.join(" · ")}`,
    path: `/log/${slug}`,
  });
}
