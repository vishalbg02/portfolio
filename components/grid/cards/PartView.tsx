"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { copyText } from "@/lib/clipboard";
import { relativeTime } from "@/lib/utils/relative-time";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils/cn";
import { ACT_EVENT } from "@/lib/grid/store";
import type { ContactAction, UiPart } from "@/lib/ai/protocol";
import type { ArchitectureGraph } from "@/components/diagram/types";
import type { MatchResult } from "@/lib/match/types";
import { BookCard, InterviewCard, LiveCard, TourCard } from "./ActionCards";
import { ConfirmCard } from "./ConfirmCard";
import { DraftCard } from "./DraftCard";
import { ProjectCardBody } from "./ProjectCardBody";
import { ResumeCard, TailorFromMatch } from "./ResumeCard";
import { card, chip } from "./styles";

const ArchitectureDiagram = dynamic(
  () => import("@/components/diagram/ArchitectureDiagram").then((m) => m.ArchitectureDiagram),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-48 animate-pulse rounded-card bg-surface-2"
        role="status"
        aria-label="Loading the diagram"
      />
    ),
  },
);
const MatchResultView = dynamic(() => import("@/components/match/MatchTool").then((m) => m.MatchResultView), {
  ssr: false,
});
const diagrams = () => import("@/components/diagram/graphs");

/** Re-run a part's side effect ("Open again"). */
const act = (part: UiPart) =>
  window.dispatchEvent(new CustomEvent(ACT_EVENT, { detail: { part, manual: true } }));

async function runContact(a: ContactAction) {
  if (a.type === "copy") {
    if (await copyText(a.text)) toast.success("Copied");
    else toast.error(`Couldn't copy: ${a.text}`);
  } else window.location.assign(a.href);
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-0">
      <dt className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-text">{children}</dd>
    </div>
  );
}

const Score = ({ n, label }: { n: number; label: string }) => (
  <div className="rounded-sm border border-border p-2.5 text-center">
    <p
      className={cn(
        "text-2xl font-semibold tabular-nums",
        n >= 90 ? "text-accent" : n >= 50 ? "text-warning" : "text-danger",
      )}
    >
      {n}
    </p>
    <p className="mt-0.5 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">{label}</p>
  </div>
);

const when = (iso: string | null) => (iso ? relativeTime(iso, Date.now()) : "unknown");

/**
 * Renders what a tool returned. Every card is built on the server from content (see lib/ai/agent/cards.ts); this
 * only draws it. `onAsk` lets a card offer a next step ("Show the diagram") that goes back into the conversation.
 */
export function PartView({
  part,
  onAsk,
  done,
  onResolve,
  compact = false,
}: {
  part: UiPart;
  /** Smaller cards, for the demo in the Ask section. */
  compact?: boolean;
  onAsk?: (q: string) => void;
  /** What the visitor did with a card that asks for a decision, so it is not offered again after a reload. */
  done?: "sent" | "cancelled";
  onResolve?: (d: "sent" | "cancelled") => void;
}) {
  switch (part.kind) {
    case "project":
      return (
        <ProjectCardBody
          part={part}
          compact={compact}
          actions={
            onAsk ? (
              <>
                <button
                  type="button"
                  className={chip}
                  onClick={() => onAsk(`Show the ${part.name} architecture`)}
                >
                  Architecture
                </button>
                <button
                  type="button"
                  className={chip}
                  onClick={() => onAsk(`Play the ${part.name} walkthrough`)}
                >
                  Walkthrough
                </button>
              </>
            ) : null
          }
        />
      );

    case "contact":
      return (
        <section aria-label="Contact details" data-grid-card="contact" className={cn(card, "p-3.5")}>
          <ul>
            {part.items.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-border py-2.5 last:border-0"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">{i.label}</p>
                  <p className="truncate text-sm text-text">{i.value}</p>
                </div>
                <div className="flex gap-1.5">
                  {i.actions.map((a) => (
                    <button key={a.label} type="button" className={chip} onClick={() => void runContact(a)}>
                      {a.label}
                      <span className="sr-only"> {i.label}</span>
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      );

    case "skill":
      return (
        <section
          aria-label={`Where he used ${part.skill}`}
          data-grid-card="skill"
          className={cn(card, "p-3.5")}
        >
          <h4 className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
            Evidence · <span className="text-text normal-case">{part.skill}</span>
          </h4>
          {part.found ? (
            <ul className="mt-2 divide-y divide-border">
              {part.where.map((w) => (
                <li key={`${w.type}-${w.title}`} className="py-2.5">
                  <p className="flex items-baseline gap-2 text-sm font-medium text-text">
                    <span className="font-mono text-[10px] tracking-[0.08em] text-accent uppercase">
                      {w.type}
                    </span>
                    {w.href ? (
                      <Link href={w.href} className="text-link underline-offset-4 hover:underline">
                        {w.title}
                      </Link>
                    ) : (
                      w.title
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{w.detail}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Not listed anywhere on this site, so there is nothing to show.
            </p>
          )}
        </section>
      );

    case "stats":
      return (
        <section aria-label="Site stats" data-grid-card="stats" className={cn(card, "p-3.5")}>
          {part.lighthouse ? (
            <>
              <div className="grid grid-cols-4 gap-2">
                <Score n={part.lighthouse.performance} label="Perf" />
                <Score n={part.lighthouse.accessibility} label="A11y" />
                <Score n={part.lighthouse.bestPractices} label="Best" />
                <Score n={part.lighthouse.seo} label="SEO" />
              </div>
              <p className="mt-2 font-mono text-[11px] text-muted">
                Lighthouse (mobile), measured {when(part.lighthouse.generatedAt)} against production, commit{" "}
                {part.lighthouse.commit}.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">No Lighthouse run has been recorded yet.</p>
          )}
          <dl className="mt-3 border-t border-border pt-1">
            <Row label="Last deploy">
              {part.deploy.builtAt ? when(part.deploy.builtAt) : "unknown"}
              {part.deploy.commit ? (
                <span className="font-mono text-xs text-muted"> · {part.deploy.commit}</span>
              ) : null}
            </Row>
            {part.products.map((p) => (
              <Row key={p.slug} label={p.name}>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-2 rounded-pill",
                      p.state === "live"
                        ? "bg-accent"
                        : p.state === "degraded"
                          ? "bg-warning"
                          : "border border-muted",
                    )}
                  />
                  {p.state === "live"
                    ? `Live${p.latencyMs !== null ? ` · ${p.latencyMs} ms` : ""}`
                    : p.state === "degraded"
                      ? "Degraded"
                      : p.state === "offline"
                        ? "Offline"
                        : "Unknown"}
                </span>
              </Row>
            ))}
          </dl>
        </section>
      );

    case "diagram":
      return (
        <section
          aria-label={`${part.name} architecture`}
          data-grid-card="diagram"
          className={cn(card, "overflow-hidden p-2")}
        >
          <DiagramLoader slug={part.slug} />
        </section>
      );

    case "demo":
      return (
        <section
          data-grid-card="demo"
          className={cn(card, "flex flex-wrap items-center justify-between gap-3 p-3.5")}
        >
          <p className="text-sm text-text">
            <span aria-hidden="true" className="mr-2 text-accent">
              ▶
            </span>
            {part.label}
          </p>
          <button type="button" className={chip} onClick={() => act(part)}>
            Open again
          </button>
        </section>
      );

    case "navigate":
      return (
        <section
          data-grid-card="navigate"
          className={cn(card, "flex flex-wrap items-center justify-between gap-3 p-3.5")}
        >
          <p className="text-sm text-text">
            <span aria-hidden="true" className="mr-2 text-accent">
              →
            </span>
            {part.label}
          </p>
          <button type="button" className={chip} onClick={() => act(part)}>
            Go again
          </button>
        </section>
      );

    case "match":
      return (
        <div data-grid-card="match" className={cn(card, "space-y-3 p-3")}>
          <MatchResultView result={part.result as MatchResult} />
          <TailorFromMatch result={part.result as MatchResult} />
        </div>
      );

    case "confirm":
      return <ConfirmCard part={part} done={done} onResolve={onResolve} />;

    case "draft":
      return <DraftCard part={part} mailto={part.mailto} />;

    case "resume":
      return <ResumeCard part={part} />;

    case "book":
      return <BookCard part={part} mailto={part.mailto} />;

    case "interview":
      return <InterviewCard part={part} mailto={part.mailto} />;

    case "live":
      return <LiveCard part={part} />;

    case "tour":
      return <TourCard part={part} />;

    case "brief":
      return (
        <section aria-label="Brief" data-grid-card="brief" className={cn(card, "p-4")}>
          <p className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">The 30-second brief</p>
          <p className="mt-1.5 text-[15px] font-medium text-text">{part.who}</p>
          <p className="mt-0.5 text-sm text-muted">{part.status}</p>
          <p className="mt-3.5 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
            Strongest proof
          </p>
          <ol className="mt-1.5 space-y-2">
            {part.proofs.map((x, i) => (
              <li key={x.title} className="flex gap-2.5 text-sm">
                <span aria-hidden="true" className="font-mono text-accent font-tabular">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <Link href={x.href} className="font-medium text-text underline-offset-4 hover:underline">
                    {x.title}
                  </Link>
                  <span className="block text-muted">{x.line}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3.5 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
            Fit for {part.role}
          </p>
          <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
            {part.fit.map((f) => (
              <li key={f.skill} className="flex items-baseline gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2 shrink-0 rounded-[2px]",
                    f.where ? "bg-accent" : "border border-border-2",
                  )}
                />
                <span className="min-w-0 text-text">
                  {f.skill}
                  <span className="text-muted"> · {f.where ?? "listed skill"}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">
            {part.podiums} hackathon podium {part.podiums === 1 ? "finish" : "finishes"}.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <a href={`mailto:${part.reach.email}`} className={chip}>
              Email
            </a>
            <a href={part.reach.linkedin} target="_blank" rel="noopener noreferrer" className={chip}>
              LinkedIn ↗<span className="sr-only"> (opens in a new tab)</span>
            </a>
            {part.reach.calLink ? (
              <a href={part.reach.calLink} target="_blank" rel="noopener noreferrer" className={chip}>
                Book 15 min ↗<span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : null}
            <Link href="/resume" className={chip}>
              Résumé
            </Link>
          </div>
        </section>
      );

    case "role":
      return (
        <section
          aria-label={`${part.title}, ${part.short}`}
          data-grid-card="role"
          className={cn(card, "p-3.5")}
        >
          <p className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
            {part.jobKind} · {part.period}
          </p>
          <p className="mt-1 text-[15px] font-medium text-text">
            {part.title}, <span className="text-muted">{part.short}</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text">{part.impact}</p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Stack">
            {part.stack.map((s) => (
              <li
                key={s}
                className="rounded-pill border border-border px-2 py-0.5 font-mono text-[11px] text-muted"
              >
                {s}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Link href={part.href} className={chip}>
              Experience →
            </Link>
            {onAsk ? (
              <button
                type="button"
                className={chip}
                onClick={() => onAsk(`What did he do at ${part.short}?`)}
              >
                Ask about it
              </button>
            ) : null}
          </div>
        </section>
      );
  }
}

/** The diagram needs its graph (a lazy chunk); load both only when the card is on screen. */
function DiagramLoader({ slug }: { slug: string }) {
  const [graph, setGraph] = useState<ArchitectureGraph | null>(null);
  useEffect(() => {
    let alive = true;
    void diagrams().then(
      (m) => alive && setGraph((m.graphs as Record<string, ArchitectureGraph>)[slug] ?? null),
    );
    return () => {
      alive = false;
    };
  }, [slug]);
  return graph ? (
    <ArchitectureDiagram graph={graph} />
  ) : (
    <div
      className="h-48 animate-pulse rounded-card bg-surface-2"
      role="status"
      aria-label="Loading the diagram"
    />
  );
}
