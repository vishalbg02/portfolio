import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "404", robots: { index: false } };

/** Phase 7 turns this into the playable snake board. */
export default function NotFound() {
  return (
    <section className="container-page py-24">
      <p className="font-mono text-sm text-muted">
        <span className="text-accent">$</span> curl -I this-page
      </p>
      <h1 className="mt-3 text-3xl font-semibold md:text-4xl">404 — this page didn&apos;t ship.</h1>
      <p className="mt-3 text-muted">The route you asked for doesn&apos;t exist (yet).</p>
      <div className="mt-8">
        <ButtonLink href="/" variant="solid">
          Go home
        </ButtonLink>
      </div>
    </section>
  );
}
