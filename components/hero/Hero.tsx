import { profile } from "@/content/profile";
import { ButtonLink } from "@/components/ui/Button";
import { StatusDot } from "@/components/ui/Chip";
import { LocalTime } from "@/components/layout/LocalTime";
import { resumeHref } from "@/lib/site";
import { Greeting } from "./Greeting";
import { Magnetic } from "./Magnetic";
import { TrailLoader } from "./TrailLoader";
import { VbgGrid } from "./VbgGrid";

/**
 * Hero. The text column (H1 = LCP element) is fully server-rendered and works with JS off;
 * the canvas trail mounts on idle, the greeting/clock are tiny client islands.
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
              <span className="text-text">{profile.status}</span>
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
                <ButtonLink href={resumeHref} variant="outline">
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
        </div>

        <div className="lg:self-center lg:justify-self-end">
          <div className="rounded-card border border-border bg-bg p-4 sm:p-6">
            <VbgGrid />
          </div>
        </div>
      </div>

      <div className="relative z-10 pb-6 text-center">
        <a
          href="#work"
          className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-xs text-muted transition-colors hover:text-text"
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
