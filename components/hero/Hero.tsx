import Link from "next/link";
import { profile } from "@/content/profile";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { StatusDot } from "@/components/ui/Chip";
import { LocalTime } from "@/components/layout/LocalTime";
import { resumeHref } from "@/lib/site";
import { Greeting } from "./Greeting";
import { NightStatus } from "./NightStatus";
import { Magnetic } from "./Magnetic";
import { TrailLoader } from "./TrailLoader";
import { ShipConsole } from "./ShipConsole";

/**
 * Hero. The text column is fully server-rendered and works with JS off; the right column is the
 * "ship console" (live project status). The canvas trail mounts on idle; greeting/clock are tiny islands.
 */
export function Hero() {
  const [city] = profile.location.split(",");

  return (
    <section
      aria-labelledby="hero-title"
      className="relative flex min-h-[calc(100svh-var(--nav-height))] flex-col overflow-hidden"
    >
      <TrailLoader />

      <div className="relative z-10 container-page grid flex-1 items-center gap-12 py-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-8 lg:py-16">
        <div>
          <p className="font-mono text-sm text-muted">~/github/vishalbg02</p>
          <div className="mt-4">
            <Greeting />
          </div>
          <h1
            id="hero-title"
            className="mt-5 text-[2.75rem] leading-none font-semibold tracking-[-0.03em] text-text md:text-5xl"
          >
            {profile.name}
            <span
              aria-hidden="true"
              className="ml-2 inline-block h-[0.8em] w-[0.42em] animate-blink bg-accent align-[-0.05em]"
            />
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted md:text-xl">{profile.headline}</p>
          <div className="mt-6 flex flex-col gap-1 text-sm text-muted sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
            <p className="flex items-center gap-2">
              <StatusDot />
              <NightStatus day={profile.status} />
            </p>
            <span aria-hidden="true" className="hidden sm:inline">
              ·
            </span>
            <p className="pl-4 sm:pl-0">
              {city}, IN <span aria-hidden="true">·</span> <LocalTime />
            </p>
          </div>
          <div className="-m-1.5 mt-8 flex flex-wrap sm:-m-2 sm:mt-8">
            <Magnetic>
              <span className="m-1.5 inline-block sm:m-2">
                <ButtonLink href="/#work" variant="solid">
                  View work
                </ButtonLink>
              </span>
            </Magnetic>
            <Magnetic>
              <span className="m-1.5 inline-block sm:m-2">
                {/* A plain link: without JS it goes to the Ask section, with JS GridHost opens the chat. */}
                <Link href="/#ask" data-grid-open="" className={buttonClass("outline")}>
                  Ask GRID
                </Link>
              </span>
            </Magnetic>
            <Magnetic>
              <span className="m-1.5 inline-block sm:m-2">
                <ButtonLink
                  href={resumeHref}
                  variant="outline"
                  target="_blank"
                  rel="noopener"
                  data-track="resume_download"
                >
                  Résumé
                </ButtonLink>
              </span>
            </Magnetic>
            <Magnetic>
              <span className="m-1.5 inline-block sm:m-2">
                <ButtonLink href="/#contact" variant="ghost">
                  Contact
                </ButtonLink>
              </span>
            </Magnetic>
          </div>
          <p className="needs-grid mt-4 text-sm text-muted">
            Ask anything about my work, or let GRID show you around.
          </p>
          <p className="mt-2 text-sm">
            <Link
              href="/?tour=1"
              data-tour-open=""
              className="tap-slop inline-flex items-center gap-1.5 rounded-sm font-mono text-xs text-link underline-offset-4 hover:underline"
            >
              <span aria-hidden="true">▶</span> Take the 60-second tour
            </Link>
          </p>
        </div>

        <div className="min-w-0 lg:self-center">
          <ShipConsole />
        </div>
      </div>

      <div className="relative z-10 pb-6 text-center">
        <a
          href="#work"
          className="tap-slop inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-xs text-muted transition-colors hover:text-text"
        >
          scroll{" "}
          <span aria-hidden="true" className="animate-nudge">
            ↓
          </span>
        </a>
      </div>
    </section>
  );
}
