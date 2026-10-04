import { LetsBuildBanner } from "@/components/sections/LetsBuildBanner";
import { ContactFormLoader } from "@/components/sections/ContactFormLoader";
import { CopyButton } from "@/components/ui/CopyButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { profile } from "@/content/profile";
import { buttonClass } from "@/components/ui/Button";

const link = buttonClass("ghost", "md", "w-full justify-between");

export function Contact() {
  const { contact } = profile;
  const links = [
    { label: "Call", href: contact.phoneHref, external: false },
    { label: "WhatsApp", href: contact.whatsapp, external: true },
    { label: "LinkedIn", href: contact.linkedin, external: true },
    { label: "GitHub", href: contact.github, external: true },
    ...(contact.calLink ? [{ label: "Book a 15-min call", href: contact.calLink, external: true }] : []),
  ];

  return (
    <section id="contact" aria-labelledby="contact-label" className="container-page section-y">
      <SectionHeader prefix="@" label="Contact" id="contact-label" />
      <LetsBuildBanner />
      <h2 className="mt-8 text-3xl font-semibold md:text-5xl">Let&apos;s build something.</h2>
      <p className="mt-4 max-w-xl text-lg text-muted">
        Hiring for SDE or full-stack roles, or looking for a hackathon teammate? Reach me however is easiest.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="space-y-3">
          <CopyButton label="Email" noun="Email" text={contact.email} event="copy_email" />
          <CopyButton label="Phone" noun="Phone" text={contact.phone} event="copy_phone" />
          <ul className="grid grid-cols-2 gap-3 pt-1">
            {links.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  className={link}
                  {...(l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {l.label}
                  <span aria-hidden="true">{l.external ? "↗" : "→"}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <ContactFormLoader toEmail={contact.email} />
      </div>
    </section>
  );
}
