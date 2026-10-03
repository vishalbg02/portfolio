import type { MetadataRoute } from "next";
import { profile } from "@/content/profile";
import { site } from "@/lib/site";

/** Grows as routes ship (work, log posts, now, resume). */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = process.env.NEXT_PUBLIC_BUILD_TIME
    ? new Date(process.env.NEXT_PUBLIC_BUILD_TIME)
    : new Date();
  return [
    { url: `${site.url}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${site.url}/work`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    ...profile.projects.map((p) => ({
      url: `${site.url}/work/${p.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
