import { SectionHeader } from "@/components/ui/SectionHeader";
import { profile } from "@/content/profile";
import { buildStackGroups } from "@/lib/stack/usage";
import { StackLoader } from "./StackLoader";

export function Stack() {
  return (
    <section id="stack" aria-labelledby="stack-label" className="container-page section-y">
      <SectionHeader
        prefix="[ ]"
        label="Stack"
        id="stack-label"
        title="What I build with"
        ask="What are his strongest skills, and where is the proof?"
      />
      <StackLoader
        groups={buildStackGroups()}
        projects={profile.projects.map((p) => ({ slug: p.slug, name: p.name }))}
        note={profile.skillsNote}
      />
    </section>
  );
}
