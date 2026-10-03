import { profile } from "@/content/profile";
import { Hero } from "@/components/hero/Hero";
import { SectionHeader } from "@/components/ui/SectionHeader";

/**
 * Phase 1 shell: server-rendered hero text (the LCP element) and section anchors.
 * Phase 2+ replaces these placeholders with the full sections.
 */
export default function HomePage() {
  return (
    <>
      <Hero />

      <section id="work" aria-labelledby="work-label" className="container-page py-16">
        <SectionHeader prefix="{ }" label="Work" id="work-label" title="Selected work" />
        <ul className="grid gap-4 md:grid-cols-2">
          {profile.projects.map((p) => (
            <li key={p.slug} className="rounded-card border border-border bg-surface p-6">
              <p className="font-mono text-xs text-muted">{p.type}</p>
              <h3 className="mt-2 text-xl font-semibold">{p.name}</h3>
              <p className="mt-1 text-muted">{p.tagline}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="experience" aria-labelledby="exp-label" className="container-page py-16">
        <SectionHeader prefix=">_" label="Experience" id="exp-label" />
        <p className="text-muted">Timeline ships in Phase 4.</p>
      </section>

      <section id="contact" aria-labelledby="contact-label" className="container-page py-16">
        <SectionHeader prefix="@" label="Contact" id="contact-label" title="Let's build something." />
        <p className="text-muted">
          Email{" "}
          <a className="text-link underline" href={`mailto:${profile.contact.email}`}>
            {profile.contact.email}
          </a>{" "}
          · Phone{" "}
          <a className="text-link underline" href={profile.contact.phoneHref}>
            {profile.contact.phone}
          </a>
        </p>
      </section>
    </>
  );
}
