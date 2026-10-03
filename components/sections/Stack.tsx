import { SectionHeader } from "@/components/ui/SectionHeader";
import { profile } from "@/content/profile";
import { buildStackGroups } from "@/lib/stack/usage";
import { StackExplorer } from "./StackExplorer";

export function Stack() {
  return (
    <section id="stack" aria-labelledby="stack-label" className="container-page section-y">
      <SectionHeader prefix="[ ]" label="Stack" id="stack-label" title="What I build with" />
      <StackExplorer
        groups={buildStackGroups()}
        projects={profile.projects.map((p) => ({ slug: p.slug, name: p.name }))}
      />
    </section>
  );
}
