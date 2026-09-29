import Link from "next/link";
import { navLinks, resumeHref } from "@/lib/site";
import { buttonClass } from "@/components/ui/Button";
import { NavShell } from "./NavShell";
import { MobileMenu } from "./MobileMenu";

export function Wordmark() {
  return (
    <Link href="/" className="group inline-flex items-center gap-1 font-mono text-sm text-text">
      <span className="text-muted transition-colors group-hover:text-text">~/</span>
      <span>vishalbg</span>
      <span aria-hidden="true" className="ml-0.5 inline-block h-4 w-2 animate-blink bg-accent" />
      <span className="sr-only"> — home</span>
    </Link>
  );
}

export function Nav() {
  return (
    <NavShell>
      <div className="container-page flex h-full items-center justify-between gap-4">
        <Wordmark />
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-sm px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface hover:text-text"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a href={resumeHref} className={buttonClass("outline", "sm")}>
            Résumé
          </a>
          <MobileMenu />
        </div>
      </div>
    </NavShell>
  );
}
