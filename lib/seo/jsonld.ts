import { profile } from "@/content/profile";
import type { Project } from "@/lib/content/profile-schema";
import { site } from "@/lib/site";

/**
 * schema.org structured data. Every value comes from content/profile.ts (no invented claims),
 * and deliberately omits email/phone so scrapers can't harvest them from the markup.
 */
const ctx = "https://schema.org";
const id = (hash: string) => `${site.url}/#${hash}`;
const abs = (path: string) => `${site.url}${path}`;

export function personNode() {
  const current = profile.experience.find((e) => e.current);
  return {
    "@type": "Person",
    "@id": id("person"),
    name: profile.name,
    alternateName: ["Vishal BG", "vishalbg02"],
    url: site.url,
    jobTitle: profile.shortRole,
    description: profile.headline,
    address: { "@type": "PostalAddress", addressLocality: "Bengaluru", addressCountry: "IN" },
    alumniOf: {
      "@type": "CollegeOrUniversity",
      name: "CHRIST (Deemed to be University)",
      address: { "@type": "PostalAddress", addressLocality: "Bengaluru", addressCountry: "IN" },
    },
    ...(current ? { worksFor: { "@type": "Organization", name: current.company.split(",")[0] } } : {}),
    knowsAbout: Object.values(profile.skills).flat(),
    knowsLanguage: profile.languages,
    sameAs: [profile.contact.linkedin, profile.contact.github],
  };
}

/** Home page graph: Person + WebSite + ProfilePage (Google's profile-page rich result). */
export function homeJsonLd() {
  return {
    "@context": ctx,
    "@graph": [
      personNode(),
      {
        "@type": "WebSite",
        "@id": id("website"),
        url: site.url,
        name: profile.name,
        description: profile.headline,
        inLanguage: "en-IN",
        publisher: { "@id": id("person") },
      },
      {
        "@type": "ProfilePage",
        "@id": id("profile"),
        url: site.url,
        name: `${profile.name} — ${profile.shortRole}`,
        isPartOf: { "@id": id("website") },
        mainEntity: { "@id": id("person") },
        ...(site.buildTime ? { dateModified: site.buildTime } : {}),
      },
    ],
  };
}

export type Crumb = { name: string; path: string };

export function breadcrumbNode(crumbs: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: abs(c.path),
    })),
  };
}

/** Case study page: the project as a CreativeWork + breadcrumbs. */
export function projectJsonLd(project: Project, description: string) {
  const path = `/work/${project.slug}`;
  return {
    "@context": ctx,
    "@graph": [
      {
        "@type": "CreativeWork",
        "@id": `${abs(path)}#project`,
        name: project.name,
        headline: project.tagline,
        description,
        url: abs(path),
        inLanguage: "en",
        author: { "@id": id("person") },
        keywords: project.stack.join(", "),
        ...(project.live ? { sameAs: [project.live] } : {}),
        ...(project.repo ? { codeRepository: project.repo } : {}),
      },
      breadcrumbNode([
        { name: "Home", path: "/" },
        { name: "Work", path: "/work" },
        { name: project.name, path },
      ]),
    ],
  };
}

export function pageJsonLd(name: string, path: string, crumbs: Crumb[]) {
  return {
    "@context": ctx,
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${abs(path)}#page`,
        url: abs(path),
        name,
        isPartOf: { "@id": id("website") },
        about: { "@id": id("person") },
      },
      breadcrumbNode(crumbs),
    ],
  };
}

/** Ship Log post: BlogPosting + breadcrumbs. */
export function postJsonLd(post: {
  title: string;
  description: string;
  slug: string;
  date: string;
  updated?: string;
  tags: string[];
}) {
  const path = `/log/${post.slug}`;
  return {
    "@context": ctx,
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${abs(path)}#post`,
        headline: post.title,
        description: post.description,
        url: abs(path),
        datePublished: post.date,
        dateModified: post.updated ?? post.date,
        inLanguage: "en",
        keywords: post.tags.join(", "),
        author: { "@id": id("person") },
        isPartOf: { "@id": id("website") },
        mainEntityOfPage: abs(path),
      },
      breadcrumbNode([
        { name: "Home", path: "/" },
        { name: "Ship Log", path: "/log" },
        { name: post.title, path },
      ]),
    ],
  };
}
