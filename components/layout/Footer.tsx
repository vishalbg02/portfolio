import { profile } from "@/content/profile";
import { site } from "@/lib/site";
import { PixelText } from "@/components/ui/PixelText";
import { Reveal } from "@/components/ui/Reveal";
import { LighthouseStrip } from "./LighthouseStrip";
import { FooterExtras } from "./FooterExtras";
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
  { label: "Privacy", href: "/privacy", external: false },
];

export function Footer() {
  const built = formatBuildDate(site.buildTime);

  return (
    <footer className="mt-8 border-t border-border md:mt-12">
      <div className="container-page flex flex-col gap-6 py-8 text-sm text-muted md:gap-7">
        {/* A tiny snake crosses the grid row once when the footer scrolls into view, then stops. */}
        <Reveal threshold={0.6} className="snake-row -mb-2">
          <svg aria-hidden="true" width="100%" height="11" className="block">
            <defs>
              <pattern id="footer-grid" width="11" height="11" patternUnits="userSpaceOnUse">
                <rect width="8" height="8" rx="2" fill="var(--grid-0)" />
              </pattern>
            </defs>
            <rect width="100%" height="11" fill="url(#footer-grid)" />
            <g className="snake">
              {[
                "var(--grid-1)",
                "var(--grid-1)",
                "var(--grid-2)",
                "var(--grid-2)",
                "var(--grid-3)",
                "var(--grid-4)",
              ].map((c, i) => (
                <rect key={i} x={i * 11} width="8" height="8" rx="2" fill={c} />
              ))}
            </g>
          </svg>
        </Reveal>

        {/* the wordmark in contribution squares, lighting left to right, beside who is here right now */}
        <div className="grid items-end gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)] md:gap-12">
          <Reveal threshold={0.4} className="footer-mark">
            <PixelText text="VISHAL B G" className="block h-auto w-full max-w-[760px]" />
          </Reveal>
          <FooterExtras />
        </div>

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

        <LighthouseStrip />

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
            <a
              href={site.repo}
              className="tap-slop hover:text-text"
              target="_blank"
              rel="noopener noreferrer"
            >
              View source ↗
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
