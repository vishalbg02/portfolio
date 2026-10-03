import { profile } from "@/content/profile";
import { Hero } from "@/components/hero/Hero";
import { SelectedWork } from "@/components/sections/SelectedWork";
import { SectionHeader } from "@/components/ui/SectionHeader";

/**
 * Phase 1 shell: server-rendered hero text (the LCP element) and section anchors.
 * Phase 2+ replaces these placeholders with the full sections.
 */
export default function HomePage() {
  return (
    <>
      <Hero />

      <SelectedWork />

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
