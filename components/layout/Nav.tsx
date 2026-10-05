import Link from "next/link";
import { navLinks, resumeHref } from "@/lib/site";
import { buttonClass } from "@/components/ui/Button";
import { getGithubData } from "@/lib/github/data";
import { latestTicker } from "@/lib/github/ticker";
import { BootLine } from "./BootLine";
import { CommitTicker } from "./CommitTicker";
import { NavShell } from "./NavShell";
import { MobileMenu } from "./MobileMenu";
import { NavPath } from "./NavPath";
import { PaletteButton } from "./PaletteButton";
import { RecruiterToggle } from "./RecruiterToggle";

/** The latest GitHub activity for the ticker. Never fails the page: no data, no ticker. */
async function latestActivity() {
  try {
    return latestTicker((await getGithubData()).activity);
  } catch {
    return null;
  }
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center font-mono text-sm text-text">
      <Link href="/" prefetch={false} className="group tap-slop inline-flex min-h-6 items-center gap-1">
        <span className="text-muted transition-colors group-hover:text-text">~/</span>
        <span>vishalbg</span>
        <span className="sr-only"> — home</span>
      </Link>
      {/* outside the link: the path is decoration, and the home link keeps one size on every page */}
      <NavPath />
      <span aria-hidden="true" className="ml-1.5 inline-block h-4 w-2 animate-blink bg-accent" />
    </span>
  );
}

export async function Nav() {
  const ticker = await latestActivity();
  return (
    <NavShell>
      <div className="container-page flex h-full items-center justify-between gap-4">
        <div className="relative">
          <Wordmark />
          {ticker ? <CommitTicker ticker={ticker} /> : null}
          <BootLine />
        </div>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={link.href.startsWith("/#") ? false : undefined}
              className="rounded-sm px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface hover:text-text"
            >
              {link.label}
            </Link>
          ))}
          <RecruiterToggle className="hidden rounded-sm px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface hover:text-text lg:block" />
        </nav>
        <div className="flex items-center gap-2">
          <PaletteButton />
          <a
            href={resumeHref}
            target="_blank"
            rel="noopener"
            className={buttonClass("outline", "sm")}
            data-track="resume_download"
          >
            Résumé
          </a>
          <MobileMenu />
        </div>
      </div>
    </NavShell>
  );
}
