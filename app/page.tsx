import { profile } from "@/content/profile";
import { ButtonLink } from "@/components/ui/Button";
import { StatusDot } from "@/components/ui/Chip";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { LocalTime } from "@/components/layout/LocalTime";
import { resumeHref } from "@/lib/site";

/**
 * Phase 1 shell: server-rendered hero text (the LCP element) and section anchors.
 * Phase 2+ replaces these placeholders with the full sections.
 */
export default function HomePage() {
  const [city] = profile.location.split(",");

  return (
    <>
      <section aria-labelledby="hero-title" className="container-page pt-16 pb-24 md:pt-28 md:pb-32">
        <p className="font-mono text-sm text-muted">~/github/vishalbg02</p>
        <h1
          id="hero-title"
          className="mt-4 text-[2.75rem] leading-none font-semibold tracking-[-0.03em] text-text md:text-5xl"
        >
          {profile.name}
          <span
            aria-hidden="true"
            className="ml-2 inline-block h-[0.8em] w-[0.42em] animate-blink bg-accent align-[-0.05em]"
          />
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted md:text-xl">{profile.headline}</p>
        <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <StatusDot />
          <span className="text-text">{profile.status}</span>
          <span aria-hidden="true">·</span>
          <span>{city}, IN</span>
          <span aria-hidden="true">·</span>
          <LocalTime />
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/#work" variant="solid">
            View work
          </ButtonLink>
          <ButtonLink href={resumeHref} variant="outline">
            Résumé
          </ButtonLink>
          <ButtonLink href="/#contact" variant="ghost">
            Contact
          </ButtonLink>
        </div>
      </section>

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
