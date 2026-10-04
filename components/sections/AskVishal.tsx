import Link from "next/link";
import { GridFace } from "@/components/grid/GridFace";
import { ProjectCardBody } from "@/components/grid/cards/ProjectCardBody";
import { LazyGridChat } from "@/components/grid/LazyGridChat";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { projectCard } from "@/lib/ai/agent/cards";

/** What GRID can do, each one a real question that opens the chat with it. They all work with no AI key too. */
const CAPABILITIES = [
  { label: "Answers with sources", question: "What has he built with Spring Boot?" },
  { label: "Shows projects", question: "Show me Talnio" },
  { label: "Draws architecture", question: "Show me the Golden Verdict architecture" },
  { label: "Plays walkthroughs", question: "Play the LanSymphony demo" },
  { label: "Proves skills", question: "Where did he use Spring Boot?" },
  { label: "Matches a job description", question: "Paste a job description and I'll show how he fits." },
  { label: "Takes you there", question: "Take me to contact" },
] as const;

/**
 * Home: GRID, the AI that knows his work. Server-rendered shell with a real example exchange (the card is the very
 * one GRID draws, built from the same content), the list of things it can do, and the full chat, which loads
 * lazily when scrolled near.
 */
export function AskVishal() {
  const card = projectCard("talnio");
  return (
    <section id="ask" aria-labelledby="ask-label" className="container-page section-y">
      <SectionHeader prefix="?" label="Ask" id="ask-label" title="Meet GRID, my AI" />
      <p className="mb-8 max-w-2xl text-muted">
        GRID knows my work and answers only from this site, with the source next to every claim. It can also
        show you things: a project, an architecture diagram, where I used a skill. If it doesn&apos;t know, it
        says so and points you to me.
      </p>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10">
        <div className="min-w-0 space-y-6">
          {card?.kind === "project" ? (
            <figure
              aria-label="An example conversation with GRID"
              className="space-y-3 rounded-card border border-border bg-surface p-4"
            >
              <div className="flex justify-end">
                <p className="rounded-card border border-border bg-surface-2 px-3.5 py-2.5 text-[15px] text-text">
                  Show me Talnio
                </p>
              </div>
              <div className="flex items-start gap-3">
                <GridFace state="idle" size={28} />
                <div className="min-w-0 flex-1 space-y-3">
                  <ProjectCardBody part={card} />
                  <p className="text-[15px] text-text">
                    Here is {card.name}: {card.tagline}.{" "}
                    <sup>
                      <Link
                        href={`/work/${card.slug}`}
                        className="font-mono text-[11px] text-link hover:underline"
                      >
                        [1]
                      </Link>
                    </sup>
                  </p>
                </div>
              </div>
              <figcaption className="font-mono text-[11px] text-muted">
                An example. Try your own below, or press <kbd className="font-mono text-text">/</kbd>{" "}
                anywhere.
              </figcaption>
            </figure>
          ) : null}

          <div>
            <h3 className="mb-3 font-mono text-xs tracking-[0.12em] text-muted uppercase">Ask it to…</h3>
            <ul className="flex flex-wrap gap-2">
              {CAPABILITIES.map((c) => (
                <li key={c.label}>
                  <Link
                    href="/#ask"
                    data-grid-open=""
                    data-grid-question={c.question}
                    className="inline-flex min-h-9 items-center rounded-pill border border-border px-3.5 text-sm text-text transition-colors hover:border-accent hover:text-accent pointer-coarse:min-h-11"
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="min-w-0">
          <LazyGridChat />
        </div>
      </div>
    </section>
  );
}
