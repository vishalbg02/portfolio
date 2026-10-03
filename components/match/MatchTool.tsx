"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/analytics";
import { copyText } from "@/lib/clipboard";
import { LIMITS } from "@/lib/ai/limits";
import { toMarkdown } from "@/lib/match/markdown";
import type { MatchItem, MatchLevel, MatchResult } from "@/lib/match/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils/cn";
import { SAMPLE_JD } from "./sample-jd";

const PILL: Record<MatchLevel, { label: string; cls: string }> = {
  strong: { label: "Strong match", cls: "border-accent text-accent" },
  partial: { label: "Partial", cls: "border-warning text-warning" },
  gap: { label: "Gap", cls: "border-border-2 text-muted" },
};

const ERRORS: Record<string, string> = {
  jd_too_short: "That's too short to be a job description — paste the whole posting.",
  jd_too_long: `Please keep it under ${LIMITS.jdInputChars.toLocaleString("en-US")} characters.`,
  rate_limited: "You've run the matcher a few times already — please try again in a few minutes.",
};

function Row({ item }: { item: MatchItem }) {
  const pill = PILL[item.match];
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span
          className={cn(
            "inline-flex h-6 items-center rounded-pill border px-2.5 font-mono text-xs",
            pill.cls,
          )}
        >
          {pill.label}
        </span>
        <span className="font-medium text-text">{item.requirement}</span>
        <span className="font-mono text-[11px] text-muted">{item.importance} priority</span>
      </div>
      {item.evidence.length > 0 ? (
        <details className="group mt-2">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm font-mono text-xs text-link select-none [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="transition-transform group-open:rotate-90">
              ›
            </span>
            Evidence ({item.evidence.length})
          </summary>
          <ul className="mt-2 space-y-2 border-l border-border pl-4">
            {item.evidence.map((e, i) => (
              <li key={i} className="text-sm text-muted">
                “{e.text}”{" "}
                <Link href={e.sourceUrl} className="whitespace-nowrap text-link underline underline-offset-2">
                  {e.title}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="mt-1.5 text-sm text-muted">Nothing on this portfolio covers it — shown as a gap.</p>
      )}
    </li>
  );
}

/**
 * Paste a job description → which requirements Vishal's portfolio supports, with evidence. Honest by
 * construction: grading is literal evidence matching on the server, so gaps are shown as gaps.
 */
export function MatchTool() {
  const id = useId();
  const [jd, setJd] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState("");

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jd }),
      });
      const body = (await res.json().catch(() => ({}))) as MatchResult & { error?: string };
      if (!res.ok) {
        setResult(null);
        setError(ERRORS[body.error ?? ""] ?? "Something went wrong while matching. Please try again.");
        return;
      }
      setResult(body);
      track("jd_match_run", { mode: body.mode });
    } catch {
      setResult(null);
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const tooLong = jd.length > LIMITS.jdInputChars;

  return (
    <div className="rounded-card border border-border bg-surface p-4 sm:p-6">
      <label htmlFor={`${id}-jd`} className="text-sm font-medium text-text">
        Paste a job description
      </label>
      <textarea
        id={`${id}-jd`}
        value={jd}
        onChange={(e) => setJd(e.target.value)}
        rows={8}
        placeholder="Paste the requirements section (or the whole posting) here…"
        aria-describedby={`${id}-count`}
        className="mt-2 w-full resize-y rounded-sm border border-border bg-bg px-3 py-2.5 text-[15px] text-text placeholder:text-muted hover:border-border-2 focus:border-accent focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button
          variant="solid"
          onClick={() => void run()}
          disabled={busy || jd.trim().length < 40 || tooLong}
        >
          {busy ? "Matching…" : "Match"}
        </Button>
        <Button variant="ghost" onClick={() => setJd(SAMPLE_JD)} disabled={busy}>
          Try an example
        </Button>
        {result || jd ? (
          <Button
            variant="ghost"
            onClick={() => {
              setJd("");
              setResult(null);
              setError("");
            }}
          >
            Clear
          </Button>
        ) : null}
        <p
          id={`${id}-count`}
          className={cn("ml-auto font-mono text-xs", tooLong ? "text-danger" : "text-muted")}
        >
          {jd.length.toLocaleString("en-US")} / {LIMITS.jdInputChars.toLocaleString("en-US")}
        </p>
      </div>

      <div aria-live="polite" className="mt-5">
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        {result ? (
          <section aria-label="Match result" className="space-y-4">
            <div className="rounded-sm border border-border bg-bg p-4">
              <p className="text-text">{result.summary}</p>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted">
                <span className="text-accent">{result.counts.strong} strong</span>
                <span className="text-warning">{result.counts.partial} partial</span>
                <span>{result.counts.gap} gap</span>
                <span>· {result.mode === "ai" ? "AI-assisted extraction" : "keyword extraction"}</span>
              </p>
            </div>
            {result.results.length > 0 ? (
              <ul className="divide-y divide-border rounded-sm border border-border">
                {result.results.map((r) => (
                  <Row key={r.requirement} item={r} />
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (await copyText(toMarkdown(result, window.location.origin)))
                    toast.success("Markdown copied");
                  else toast.error("Couldn't copy");
                }}
              >
                Copy as Markdown
              </Button>
              <p className="text-xs text-muted">
                Gaps are shown as gaps. Matching uses only what&apos;s written on this site.
              </p>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
