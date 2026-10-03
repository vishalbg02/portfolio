import type { Metadata } from "next";
import { LazySnake } from "@/components/games/LazySnake";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "404", robots: { index: false } };

export default function NotFound() {
  return (
    <section className="container-page py-16 md:py-24">
      <p className="font-mono text-sm text-muted">
        <span className="text-accent">$</span> curl -I this-page
      </p>
      <h1 className="mt-3 text-3xl font-semibold md:text-4xl">404 — this page didn&apos;t ship.</h1>
      <p className="mt-3 text-muted">The route you asked for doesn&apos;t exist (yet).</p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <ButtonLink href="/" variant="solid">
          Go home
        </ButtonLink>
        <ButtonLink href="/work" variant="ghost">
          See my work
        </ButtonLink>
      </div>
      <div className="mt-12">
        <LazySnake />
      </div>
    </section>
  );
}
