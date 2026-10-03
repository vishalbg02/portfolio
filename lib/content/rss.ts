import { profile } from "@/content/profile";
import type { Post } from "./log";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const rfc822 = (iso: string) => new Date(`${iso}T00:00:00Z`).toUTCString();

/** RSS 2.0 for the Ship Log. Pure: pass the posts and the site origin. */
export function buildRss(posts: Post[], siteUrl: string): string {
  const items = posts
    .map((p) => {
      const f = p.frontmatter;
      const url = `${siteUrl}/log/${f.slug}`;
      return [
        "    <item>",
        `      <title>${esc(f.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${rfc822(f.date)}</pubDate>`,
        `      <description>${esc(f.description)}</description>`,
        ...f.tags.map((t) => `      <category>${esc(t)}</category>`),
        "    </item>",
      ].join("\n");
    })
    .join("\n");
  const last = posts[0] ? rfc822(posts[0].frontmatter.date) : new Date(0).toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Ship Log · ${esc(profile.name)}</title>
    <link>${siteUrl}/log</link>
    <description>Notes on building and shipping software, by ${esc(profile.name)}.</description>
    <language>en-IN</language>
    <lastBuildDate>${last}</lastBuildDate>
    <atom:link href="${siteUrl}/log/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}
