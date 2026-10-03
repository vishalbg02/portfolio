import type { MetadataRoute } from "next";
import { profile } from "@/content/profile";
import { resumeConfig } from "@/content/resume";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const built = process.env.NEXT_PUBLIC_BUILD_TIME
    ? new Date(process.env.NEXT_PUBLIC_BUILD_TIME)
    : new Date();
  const resumeUpdated = new Date(`${resumeConfig.updatedAt}T00:00:00Z`);
  return [
    { url: `${site.url}/`, lastModified: built, changeFrequency: "weekly", priority: 1 },
    { url: `${site.url}/work`, lastModified: built, changeFrequency: "monthly", priority: 0.9 },
    ...profile.projects.map((p) => ({
      url: `${site.url}/work/${p.slug}`,
      lastModified: built,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${site.url}/resume`, lastModified: resumeUpdated, changeFrequency: "monthly", priority: 0.8 },
    // The PDF itself: recruiters often search for "<name> resume pdf".
    { url: `${site.url}/resume.pdf`, lastModified: resumeUpdated, changeFrequency: "monthly", priority: 0.6 },
  ];
}
