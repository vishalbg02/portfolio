import { notFound } from "next/navigation";
import { profile } from "@/content/profile";
import { getAllCaseStudySlugs } from "@/lib/content/work";
import { OG_SIZE, OG_TYPE, renderOg } from "@/lib/seo/og";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "Case study — Vishal B G";

const ACCENT: Record<string, string> = {
  "golden-verdict": "#e3b341",
  talnio: "#3fb950",
  lansymphony: "#58a6ff",
  "virtual-tour": "#bc8cff",
};

export function generateStaticParams() {
  return getAllCaseStudySlugs().map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = profile.projects.find((p) => p.slug === slug);
  if (!project) notFound();
  return renderOg({
    title: project.name,
    kicker: `Case study · ${project.tagline}`,
    path: `/work/${slug}`,
    accent: ACCENT[slug],
  });
}
