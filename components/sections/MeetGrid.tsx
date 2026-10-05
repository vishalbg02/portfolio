import Link from "next/link";
import { GridFace } from "@/components/grid/GridFace";
import { LazyGridChat } from "@/components/grid/LazyGridChat";
import { SAMPLE_JD } from "@/components/match/sample-jd";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { LANGS } from "@/lib/ai/lang";
import { TOOL_NAMES } from "@/lib/ai/protocol";
import { corpusInfo } from "@/lib/rag/store";

/**
 * What GRID can do: each tile runs that real request in the chat below (no recording, no script). Most are answered
 * by the deterministic router, so they work with no AI key; "Answers with sources" goes through retrieval.
 */
const TILES = [
  { label: "Answers with sources", example: "What has he built with Spring Boot?", run: "What has he built with Spring Boot?" },
  { label: "Shows projects", example: "Show me Talnio", run: "Show me Talnio" },
  { label: "Draws architecture", example: "Show me the Golden Verdict architecture", run: "Show me the Golden Verdict architecture" },
  { label: "Plays walkthroughs", example: "Play the LanSymphony walkthrough", run: "Play the LanSymphony walkthrough" },
  { label: "Proves skills", example: "Where did he use Java?", run: "Where did he use Java?" },
  { label: "Matches a job description", example: "Paste a JD: here, a sample one", run: SAMPLE_JD },
  { label: "Tailors a résumé", example: "Tailor his résumé for a backend role", run: "Tailor his résumé for a backend role" },
  { label: "Messages Vishal", example: "I'd like to send Vishal a message", run: "I'd like to send Vishal a message" },
] as const;

/** "How GRID works": the pipeline a real request lights up as it passes (lib/grid/stages.ts drives it live). */
const STEPS = [
  { id: "question", title: "Your question", caption: "Anything about his work; a pasted job description too" },
  { id: "retrieve", title: "Retrieve", caption: "BM25 and embeddings over this site's own text" },
  { id: "rank", title: "Rank", caption: "Fused by rank; too weak a match is refused" },
  { id: "tools", title: "Tools", caption: "Cards built from content, never by the model" },
  { id: "answer", title: "Answer", caption: "With a numbered source on every claim" },
] as const;

const HONESTY = [
  { title: "A source on every claim", body: "Click one and the page scrolls to the proof." },
  { title: "No guessing", body: "Outside what this site says, it says so." },
  { title: "Works without AI", body: "No model? It answers from the site's text, and says so." },
  { title: "Asks before it sends", body: "It prepares a message; only you can send it." },
] as const;

/** A tiny square glyph for the honesty row: the system's icons are made of squares too. */
function SquareGlyph({ i }: { i: number }) {
  const on = [
    [0, 2, 4],
    [1, 3, 4],
    [0, 1, 3],
    [2, 3, 4],
  ][i % 4]!;
  return (
    <svg viewBox="0 0 11 11" width="14" height="14" aria-hidden="true" className="mt-1 shrink-0">
      {[0, 1, 2, 3, 4].map((k) => {
        const x = [0, 6, 3, 0, 6][k]!;
        const y = [0, 0, 3, 6, 6][k]!;
        return <rect key={k} x={x} y={y} width="5" height="5" rx="1" fill={on.includes(k) ? "var(--accent)" : "var(--grid-1)"} />;
      })}
    </svg>
  );
}

/**
 * Home: Meet GRID, the showpiece (docs/GRID-AGENT.md). A stage with GRID's face and three counts read from the real
 * code (passages indexed, tools, languages), a command deck where every tile runs a real request, the chat itself,
 * the pipeline that lights up as a request passes through it, and four promises the code keeps.
 *
 * Everything here is server-rendered and works as links without JavaScript; the live parts (the face that follows
 * the pointer, tiles that run, the strip that lights) are one lazy chunk, loaded with the chat when the section is near.
 */
export function MeetGrid() {
  const passages = corpusInfo().chunks;
  const languages = LANGS.filter((l) => l !== "auto").length;
  return (
    <section id="ask" aria-labelledby="ask-label" className="container-page section-y" data-meet-grid="">
      <SectionHeader prefix="?" label="Ask" id="ask-label" title="Meet GRID, my AI" />

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)]">
        {/* the stage */}
        <div className="brackets flex flex-col items-center justify-center rounded-card border border-border bg-surface px-6 py-8 text-center">
          <div data-grid-stage="" className="relative">
            <GridFace state="idle" size={168} className="gf-live max-sm:hidden" />
            <GridFace state="idle" size={112} className="gf-live sm:hidden" />
          </div>
          <p className="mt-6 max-w-sm text-xl leading-snug font-semibold text-balance text-text md:text-2xl">
            It has read every page of this site, so you don&apos;t have to.
          </p>
          <ul className="mt-5 flex flex-wrap justify-center gap-2" aria-label="GRID in numbers">
            {[
              [passages, "passages indexed"],
              [TOOL_NAMES.length, "tools"],
              [languages, "languages"],
            ].map(([n, what]) => (
              <li
                key={what}
                className="inline-flex items-baseline gap-1.5 rounded-pill border border-border px-3 py-1 font-mono text-xs text-muted"
              >
                <span className="font-tabular text-text">{n}</span> {what}
              </li>
            ))}
          </ul>
        </div>

        {/* the command deck */}
        <div className="min-w-0">
          <h3 className="mb-3 font-mono text-xs tracking-[0.12em] text-muted uppercase">Run a real request</h3>
          <ul className="grid gap-2 sm:grid-cols-2" data-grid-deck="">
            {TILES.map((t, i) => (
              <li key={t.label}>
                <Link
                  href="/#ask"
                  prefetch={false}
                  data-grid-run={t.run}
                  data-tile={i}
                  data-cursor="ask"
                  className="grid-tile group flex h-full min-h-[76px] flex-col rounded-card border border-border bg-surface px-3.5 py-3 transition-colors hover:border-accent focus-visible:border-accent"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs tracking-[0.08em] text-text uppercase">{t.label}</span>
                    <span
                      aria-hidden="true"
                      className="inline-flex items-center gap-1 font-mono text-[11px] text-muted transition-colors group-hover:text-accent"
                    >
                      Run <span>▶</span>
                    </span>
                  </span>
                  <span className="mt-1.5 block text-[13px] leading-snug text-muted">{t.example}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 font-mono text-[11px] text-muted">
            Each one runs in the chat below, for real. Press <kbd className="font-mono text-text">/</kbd> anywhere to
            ask your own.
          </p>
        </div>
      </div>

      {/* the chat */}
      <div className="mx-auto mt-10 max-w-[960px]" data-grid-inline="">
        <LazyGridChat />
      </div>

      {/* how it works: lit live by the stream's stage events */}
      <div className="mx-auto mt-10 max-w-[960px]">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="font-mono text-xs tracking-[0.12em] text-muted uppercase">How GRID works</h3>
          <Link
            href="/log/an-assistant-that-says-i-dont-know"
            className="font-mono text-[11px] text-link underline-offset-4 hover:underline"
          >
            Read how it was built →
          </Link>
        </div>
        <ol data-pipeline="" data-router="false" className="grid-pipeline grid gap-2 sm:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.id} data-step={s.id} data-state="idle" className="grid-step">
              <span className="flex items-center gap-2 font-mono text-xs text-text">
                <span aria-hidden="true" className="grid-step-sq" />
                <span className="font-tabular text-muted">{i + 1}</span>
                {s.title}
                <span data-count="" className="font-tabular text-muted" />
              </span>
              <span className="mt-1 block text-[12px] leading-snug text-muted">{s.caption}</span>
            </li>
          ))}
        </ol>
        <p data-pipeline-note="" className="mt-2 min-h-5 font-mono text-[11px] text-muted" aria-live="polite" />
      </div>

      {/* what the code promises */}
      <ul className="mx-auto mt-8 grid max-w-[960px] gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        {HONESTY.map((h, i) => (
          <li key={h.title} className="flex gap-2.5">
            <SquareGlyph i={i} />
            <p className="text-[13px] leading-snug text-muted">
              <span className="block font-medium text-text">{h.title}</span>
              {h.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
