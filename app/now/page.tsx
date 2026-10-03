import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { now } from "@/content/now";
import { pageJsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { formatIsoDate } from "@/lib/utils/format-date";

export const metadata: Metadata = pageMetadata({
  title: "Now",
  description: "What Vishal B G is working on, studying and looking for right now.",
  path: "/now",
});

export default function NowPage() {
  const rows: Array<[string, string | null]> = [
    ["Working", now.working],
    ["Studying", now.studying],
    ["Building", now.building],
    ["Learning", now.learning],
    ["Reading", now.reading],
    ["Looking for", now.lookingFor],
    ["Elsewhere", now.elsewhere],
  ];
  return (
    <div className="container-page py-12 md:py-20">
      <JsonLd
        data={pageJsonLd("Now", "/now", [
          { name: "Home", path: "/" },
          { name: "Now", path: "/now" },
        ])}
      />
      <SectionHeader prefix="~" label="Now" id="now-label" />
      <h1 className="text-3xl font-semibold md:text-4xl">What I&apos;m doing now</h1>
      <p className="mt-3 font-mono text-xs text-muted">
        Updated <time dateTime={now.updatedAt}>{formatIsoDate(now.updatedAt)}</time>
      </p>
      <dl className="mt-10 max-w-3xl divide-y divide-border border-y border-border">
        {rows
          .filter((r): r is [string, string] => r[1] !== null)
          .map(([label, text]) => (
            <div key={label} className="grid gap-1 py-5 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-6">
              <dt className="font-mono text-xs tracking-[0.12em] text-muted uppercase sm:pt-1">{label}</dt>
              <dd className="text-[17px] leading-relaxed text-text">{text}</dd>
            </div>
          ))}
      </dl>
      <p className="mt-8 text-sm text-muted">
        Inspired by{" "}
        <a href="https://nownownow.com/about" className="text-link underline underline-offset-4">
          the /now page movement
        </a>
        .
      </p>
    </div>
  );
}
