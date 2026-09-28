import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** Grows as routes ship (work, log posts, now, resume). */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = process.env.NEXT_PUBLIC_BUILD_TIME
    ? new Date(process.env.NEXT_PUBLIC_BUILD_TIME)
    : new Date();
  return [{ url: `${site.url}/`, lastModified, changeFrequency: "weekly", priority: 1 }];
}
