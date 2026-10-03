import type { Metadata } from "next";
import { LazySnake } from "@/components/games/LazySnake";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "404", robots: { index: false } };

export default function NotFound() {
  return (
    <section className="container-page section-y">
      <div className="grid items-center gap-10 py-6 md:gap-16 lg:grid-cols-[minmax(0,1fr)_360px] lg:py-12">
        <div>
          <p className="font-mono text-sm text-muted">
            <span className="text-accent">$</span> curl -I this-page
          </p>
          <h1 className="mt-3 text-3xl font-semibold md:text-5xl">404 — this page didn&apos;t ship.</h1>
          <p className="mt-3 max-w-md text-lg text-muted">
            The route you asked for doesn&apos;t exist (yet). While you&apos;re here, the board on the{" "}
            <span className="hidden lg:inline">right</span>
            <span className="lg:hidden">below</span> is playable.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/" variant="solid">
              Go home
            </ButtonLink>
            <ButtonLink href="/work" variant="ghost">
              See my work
            </ButtonLink>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <LazySnake />
        </div>
      </div>
    </section>
  );
}
