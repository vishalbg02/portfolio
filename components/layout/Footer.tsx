import { profile } from "@/content/profile";
import { site } from "@/lib/site";
import { LocalTime } from "./LocalTime";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "29 Sep 2026" in IST — deterministic across ICU versions (en-GB would print "Sept"). */
function formatBuildDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ist = new Date(d.getTime() + 330 * 60_000);
  return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]} ${ist.getUTCFullYear()}`;
}

const footerLinks = [
  { label: "GitHub", href: profile.contact.github, external: true },
  { label: "LinkedIn", href: profile.contact.linkedin, external: true },
  { label: "Email", href: `mailto:${profile.contact.email}`, external: false },
  { label: "Résumé", href: "/resume", external: false },
  { label: "Recruiter mode", href: "/recruiter", external: false },
  { label: "Now", href: "/now", external: false },
];

export function Footer() {
  const built = formatBuildDate(site.buildTime);

  return (
    <footer className="mt-8 border-t border-border md:mt-12">
      <div className="container-page flex flex-col gap-8 py-10 text-sm text-muted">
        <p className="font-mono text-text">
          <span className="text-accent">$</span> exit <span className="text-muted">·</span> thanks for
          visiting{" "}
          <span aria-hidden="true" className="text-accent">
            ●
          </span>
        </p>

        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {footerLinks.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  className="transition-colors hover:text-text"
                  {...(l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {l.label}
                  {l.external ? <span aria-hidden="true"> ↗</span> : null}
                </a>
              </li>
            ))}
          </ul>

          <p className="font-mono text-xs">
            Bengaluru · <LocalTime />
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-6 font-mono text-xs md:flex-row md:items-center md:justify-between">
          <p>Built with Next.js · Deployed on Vercel</p>
          <p className="flex flex-wrap items-center gap-x-2">
            {built ? <span>Last deployed {built}</span> : null}
            {site.commitSha ? (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={`${site.repo}/commit/${site.commitSha}`}
                  className="hover:text-text"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {site.commitSha}
                </a>
              </>
            ) : null}
            <span aria-hidden="true">·</span>
            <a href={site.repo} className="hover:text-text" target="_blank" rel="noopener noreferrer">
              View source ↗
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
