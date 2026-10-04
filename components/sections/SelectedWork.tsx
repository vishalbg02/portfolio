import Link from "next/link";
import { profile } from "@/content/profile";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ShowcasePanel } from "@/components/work/ShowcasePanel";
import { ShowcaseShell } from "@/components/work/ShowcaseShell";

/**
 * Home: the four products on a "product stage" (desktop: numbered index + stage, grid-wipe between
 * projects; mobile: swipeable deck). Panels are server-rendered; the shell is the only client part.
 */
export function SelectedWork() {
  const items = profile.projects.map((p) => ({ slug: p.slug, name: p.name, tagline: p.tagline }));
  return (
    <section id="work" aria-labelledby="work-label" className="container-page section-y">
      <SectionHeader prefix="{ }" label="Work" id="work-label" title="Selected work" />
      <ShowcaseShell items={items}>
        {profile.projects.map((p, i) => (
          <ShowcasePanel key={p.slug} project={p} index={i} />
        ))}
      </ShowcaseShell>
      <p className="mt-8">
        <Link href="/work" className="font-mono text-sm text-link underline-offset-4 hover:underline">
          All projects <span aria-hidden="true">→</span>
        </Link>
      </p>
    </section>
  );
}
