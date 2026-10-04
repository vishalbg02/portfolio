import Link from "next/link";
import { GridFace } from "@/components/grid/GridFace";
import { LazyGridChat } from "@/components/grid/LazyGridChat";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { buildDemoScenes } from "@/lib/ai/agent/demo";

/** What GRID can do, each one a real question that opens the chat with it. They all work with no AI key too. */
const CAPABILITIES = [
  { label: "Answers with sources", question: "What has he built with Spring Boot?" },
  { label: "Shows projects", question: "Show me Talnio" },
  { label: "Draws architecture", question: "Show me the Golden Verdict architecture" },
  { label: "Plays walkthroughs", question: "Play the LanSymphony demo" },
  { label: "Proves skills", question: "Where did he use Spring Boot?" },
  { label: "Matches a job description", question: "Paste a job description and I'll show how he fits." },
  { label: "Takes you there", question: "Take me to contact" },
  { label: "Puts you in touch", question: "Can I talk to Vishal live?" },
] as const;

/** What a visitor can rely on. Each line is something the code does, not a hope. */
const PROMISES = [
  { title: "A source on every claim", body: "Click one and the page scrolls to the proof." },
  { title: "No guessing", body: "Outside what this site says, it says so and points you to me." },
  {
    title: "Works without AI",
    body: "If the model is down it answers from the site's own text, and tells you.",
  },
  { title: "Three languages", body: "English, ಕನ್ನಡ and हिन्दी, on request." },
] as const;

/**
 * Home: GRID, the AI that knows his work. A server-rendered pitch and the list of things it can do, beside the full
 * chat. The chat loads lazily when scrolled near and opens with a short loop of real exchanges (the router's own
 * answers, built from content here at build time), so a visitor sees what it does before asking anything.
 */
export async function AskVishal() {
  const scenes = await buildDemoScenes();
  return (
    <section id="ask" aria-labelledby="ask-label" className="container-page section-y">
      <SectionHeader prefix="?" label="Ask" id="ask-label" title="Meet GRID, my AI" />

      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:grid-rows-[auto_1fr]">
        {/* the source order is also the reading order: pitch, chat with its demo, details; from lg the chat sits beside the other two */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="flex items-start gap-4">
            <GridFace state="idle" size={56} className="mt-1 shrink-0" />
            <div>
              <p className="text-xl leading-snug font-semibold text-text md:text-2xl">
                It has read every page of this site, so you don&apos;t have to.
              </p>
              <p className="mt-2 max-w-xl text-muted">
                Ask about my work, my skills or my experience. GRID answers only from what is written here,
                and can show you things: a project, an architecture diagram, where I used a skill.
              </p>
            </div>
          </div>
        </div>

        <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <LazyGridChat scenes={scenes} />
        </div>

        <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-2">
          <ul className="space-y-3.5">
            {PROMISES.map((p) => (
              <li key={p.title} className="flex gap-3">
                <span aria-hidden="true" className="mt-[7px] size-2 shrink-0 rounded-[2px] bg-accent" />
                <p className="text-[15px] text-muted">
                  <span className="font-medium text-text">{p.title}.</span> {p.body}
                </p>
              </li>
            ))}
          </ul>

          <div>
            <h3 className="mb-3 font-mono text-xs tracking-[0.12em] text-muted uppercase">Ask it to…</h3>
            <ul className="grid grid-cols-2 gap-2">
              {CAPABILITIES.map((c) => (
                <li key={c.label}>
                  <Link
                    href="/#ask"
                    prefetch={false}
                    data-grid-open=""
                    data-grid-question={c.question}
                    data-cursor="ask"
                    className="group block h-full rounded-card border border-border bg-surface px-3.5 py-3 transition-colors hover:border-accent pointer-coarse:min-h-11"
                  >
                    <span className="flex items-center justify-between gap-2 text-sm font-medium text-text">
                      {c.label}
                      <span
                        aria-hidden="true"
                        className="text-muted transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-accent"
                      >
                        →
                      </span>
                    </span>
                    <span className="mt-1 block font-mono text-[11px] leading-snug text-muted">
                      {c.question.length > 44 ? "Paste a job description" : c.question}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-4 font-mono text-[11px] text-muted">
              Press <kbd className="font-mono text-text">/</kbd> or{" "}
              <kbd className="font-mono text-text">⌘ K</kbd> anywhere to ask from any page.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
