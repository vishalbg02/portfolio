"use client";

import { useState } from "react";
import type { UiPart } from "@/lib/ai/protocol";
import { track } from "@/lib/analytics";
import type { MatchResult } from "@/lib/match/types";
import { card, primary, quiet } from "./styles";

type Resume = Extract<UiPart, { kind: "resume" }>;
type Reqs = Resume["requirements"];

const List = ({ title, items, empty }: { title: string; items: string[]; empty: string }) => (
  <div>
    <h4 className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">{title}</h4>
    {items.length > 0 ? (
      <ul className="mt-1 space-y-0.5 text-sm text-text">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden="true" className="text-accent">
              ›
            </span>
            <span className="min-w-0 break-words">{i}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-1 text-sm text-muted">{empty}</p>
    )}
  </div>
);

/** A tailored résumé: what moved, what is emphasised, what is still a gap, and the one-page PDF to download. */
export function ResumeCard({ part }: { part: Resume }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const download = async () => {
    setBusy(true);
    setProblem("");
    try {
      const res = await fetch("/api/resume/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirements: part.requirements, role: part.role ?? undefined }),
      });
      if (!res.ok) {
        setProblem(
          res.status === 429
            ? "That's a lot of résumés. Please try again in a few minutes."
            : "Couldn't build the PDF just now. The standard résumé is on the Résumé page.",
        );
        return;
      }
      const name =
        /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ??
        "Vishal_BG_Resume_Tailored.pdf";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      track("resume_tailored");
    } catch {
      setProblem("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-grid-card="resume" aria-label="Tailored résumé" className={`${card} p-3.5`}>
      <p className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
        Tailored résumé{part.role ? ` · ${part.role}` : ""}
      </p>
      <div className="mt-3 space-y-3">
        <List
          title="Moved up"
          items={part.movedUp}
          empty="Nothing needed to move: it already leads with this."
        />
        <List title="Emphasised skills" items={part.emphasised} empty="The skills already lead with these." />
        <List
          title="Gaps (not hidden)"
          items={part.gaps}
          empty="Every requirement is supported by something on the résumé."
        />
      </div>
      {problem ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {problem}
        </p>
      ) : null}
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <button type="button" className={primary} disabled={busy} onClick={() => void download()}>
          {busy ? "Building…" : "Download PDF"}
        </button>
      </div>
      <p className="mt-2.5 font-mono text-[11px] text-muted">
        One page. It only re-orders what he already wrote; no new text is added.
      </p>
    </section>
  );
}

/** On a job-match card: asks for the same résumé tailored to this job's requirements, then shows the card above. */
export function TailorFromMatch({ result }: { result: MatchResult }) {
  const [part, setPart] = useState<Resume | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  if (part) return <ResumeCard part={part} />;

  const requirements: Reqs = result.results
    .filter((r) => !/^\d{1,2}\+?\s*years/i.test(r.requirement))
    .map((r) => ({ skill: r.requirement, importance: r.importance }));
  if (requirements.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        className={quiet}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setProblem("");
          try {
            const res = await fetch("/api/resume/tailor", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ requirements, format: "summary" }),
            });
            if (!res.ok) throw new Error(String(res.status));
            const { summary } = (await res.json()) as {
              summary: { movedUp: string[]; emphasised: string[]; gaps: string[] };
            };
            setPart({ kind: "resume", role: null, requirements, ...summary });
          } catch {
            setProblem("Couldn't tailor the résumé just now. Please try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Working…" : "Tailor his résumé for this job"}
      </button>
      {problem ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
