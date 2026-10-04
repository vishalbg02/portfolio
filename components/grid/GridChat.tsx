"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { MODE_LABEL, MODE_SUGGESTIONS, BRIEF_PROMPT, availableModes } from "@/lib/ai/modes";
import type { ChatMode } from "@/lib/ai/protocol";
import { inputLimit } from "@/lib/ai/agent/jd";
import { gridStore, type Msg } from "@/lib/grid/store";
import { toTranscript } from "@/lib/grid/export";
import { useGridStore } from "@/lib/grid/use-store";
import { cn } from "@/lib/utils/cn";
import { AnswerText } from "./AnswerText";
import { PartView } from "./cards/PartView";
import { GridFace, type FaceState } from "./GridFace";
import { SourcesRow } from "./SourcesRow";

const MODE_NOTE: Partial<Record<ChatMode, string>> = {
  offline: "Offline mode — answered straight from this site's content, no AI.",
  refusal: "I only answer questions about Vishal.",
};

const TOOL_LABEL: Record<string, string> = {
  search_profile: "Searching his profile",
  navigate: "Taking you there",
  show_project: "Pulling up the project",
  play_demo: "Opening the walkthrough",
  show_diagram: "Drawing the architecture",
  show_skill_evidence: "Finding the evidence",
  match_job: "Matching the job description",
  get_contact: "Getting his contact details",
  get_site_stats: "Reading the site's numbers",
};

/** Stops a runaway paste in the field itself; the real limit is `inputLimit`. */
const LIMITS_HARD = 7_000;

const chip =
  "inline-flex min-h-8 items-center rounded-pill border border-border px-3 text-left text-sm text-text transition-colors hover:border-accent hover:text-accent pointer-coarse:min-h-11";

export function faceFor(busy: boolean, last: Msg | undefined, typing: boolean): FaceState {
  if (busy) {
    if (last?.tools.some((t) => t.state === "running")) return "acting";
    return last?.text ? "speaking" : "thinking";
  }
  return typing ? "listening" : "idle";
}

/**
 * GRID's conversation: a view over the shared store. The same component is the side sheet's body, the
 * phone's full-screen chat and the inline chat in the Ask section; they all show one conversation.
 */
export function GridChat({
  variant,
  autoFocus = false,
  controls,
  onJump,
}: {
  variant: "inline" | "sheet";
  autoFocus?: boolean;
  /** Extra header buttons (close, dock …) supplied by the sheet. */
  controls?: ReactNode;
  /** Called when a cited source is used, so a modal sheet can close and let the page scroll. */
  onJump?: () => void;
}) {
  const { messages, mode, busy, ai } = useGridStore();
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const uid = useId();
  const last = messages.at(-1);
  const empty = messages.length === 0;
  const limit = inputLimit(input);
  const tooLong = input.length > limit;

  useEffect(() => {
    if (autoFocus) field.current?.focus();
  }, [autoFocus]);

  // Keep the newest text in view while streaming, unless the visitor has scrolled up to read. "Stuck to the bottom"
  // is remembered from scroll events: measuring after the content grew would call a tall new card "scrolled up".
  const stuck = useRef(true);
  useEffect(() => {
    const el = log.current;
    if (el && stuck.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const ask = (q: string) => {
    stuck.current = true; // asking brings you to the answer
    void gridStore.send(q);
    field.current?.focus();
  };
  const submit = () => {
    if (!input.trim() || tooLong || busy) return;
    const q = input;
    setInput("");
    ask(q);
  };

  const download = () => {
    const blob = new Blob([toTranscript(messages, window.location.origin)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "grid-conversation.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const face = faceFor(busy, last, focused && input.length > 0);
  const small =
    "shrink-0 rounded-sm font-mono text-xs whitespace-nowrap text-muted transition-colors hover:text-text pointer-coarse:min-h-11 pointer-coarse:px-2";

  return (
    <div
      className={cn(
        "flex flex-col",
        variant === "sheet" ? "h-full" : "rounded-card border border-border bg-surface",
      )}
    >
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <GridFace state={face} size={32} label={`GRID is ${face === "idle" ? "ready" : face}`} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm text-text">GRID</p>
          <p className="flex items-center gap-1.5 truncate font-mono text-[11px] whitespace-nowrap text-muted">
            <span
              aria-hidden="true"
              className={cn("size-1.5 rounded-pill", ai ? "bg-accent" : "border border-muted")}
            />
            <span className="max-sm:hidden">Vishal&apos;s AI · </span>
            {ai === null ? "checking…" : ai ? "online" : "offline mode"}
          </p>
        </div>
        {controls}
      </div>

      <div
        className="flex items-center gap-1.5 overflow-x-auto border-b border-border px-4 py-2.5 sm:flex-wrap"
        role="group"
        aria-label="Mode"
      >
        <button
          type="button"
          disabled={busy}
          onClick={() => ask(BRIEF_PROMPT)}
          className="inline-flex min-h-8 shrink-0 items-center rounded-pill border border-accent px-3 font-mono text-xs whitespace-nowrap text-accent transition-colors hover:bg-accent hover:text-bg disabled:opacity-50 pointer-coarse:min-h-11"
        >
          {BRIEF_PROMPT}
        </button>
        {availableModes().map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => gridStore.setMode(m)}
            className={cn(
              "inline-flex min-h-8 shrink-0 items-center rounded-pill border px-3 font-mono text-xs whitespace-nowrap transition-colors pointer-coarse:min-h-11",
              mode === m
                ? "border-border-2 bg-surface-2 text-text"
                : "border-border text-muted hover:border-border-2 hover:text-text",
            )}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>

      <div
        ref={log}
        onScroll={(e) => {
          const el = e.currentTarget;
          stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label="Conversation with GRID"
        className={cn(
          "space-y-5 overflow-y-auto px-4 py-4",
          variant === "sheet" ? "min-h-0 flex-1" : "max-h-[520px] min-h-[260px]",
        )}
      >
        {empty ? (
          <div>
            <p className="text-sm text-muted">
              I&apos;m GRID, Vishal&apos;s AI. Ask about his work, skills or experience (answers come only
              from this site, with sources), or ask me to show you something: a project, an architecture
              diagram, where he used a skill. Paste a job description and I&apos;ll match it.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Suggested questions">
              {MODE_SUGGESTIONS[mode].map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => ask(s)} className={chip}>
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-card border border-border bg-surface-2 px-3.5 py-2.5 text-[15px] whitespace-pre-wrap text-text">
                {m.text}
              </p>
            </div>
          ) : (
            <div key={m.id} className="max-w-[96%] space-y-3" aria-busy={m.pending}>
              {m.tools
                .filter((t) => t.state === "running")
                .map((t) => (
                  <p key={t.id} role="status" className="font-mono text-xs text-muted">
                    <span aria-hidden="true" className="mr-2 text-accent">
                      ▸
                    </span>
                    {TOOL_LABEL[t.name] ?? "Working"}
                    <span className="animate-blink">…</span>
                  </p>
                ))}
              {m.parts.map((p) => (
                <PartView key={p.id} part={p.part} onAsk={busy ? undefined : ask} />
              ))}
              {m.pending && !m.text && m.tools.every((t) => t.state !== "running") && m.parts.length === 0 ? (
                <p className="font-mono text-sm text-muted" role="status">
                  Thinking<span className="animate-blink">…</span>
                </p>
              ) : m.text ? (
                <AnswerText text={m.text} sources={m.sources} />
              ) : null}
              {m.mode && MODE_NOTE[m.mode] ? (
                <p className="font-mono text-[11px] text-muted">{MODE_NOTE[m.mode]}</p>
              ) : null}
              {m.error ? (
                <p role="alert" className="text-sm text-danger">
                  {m.error}
                </p>
              ) : null}
              <SourcesRow text={m.text} sources={m.sources} onJump={onJump} />
              {i === messages.length - 1 && !busy && m.followups.length > 0 ? (
                <ul className="flex flex-wrap gap-2 pt-1" aria-label="Suggested follow-ups">
                  {m.followups.map((f) => (
                    <li key={f}>
                      <button type="button" onClick={() => ask(f)} className={chip}>
                        {f}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ),
        )}
      </div>

      <form
        className="border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor={`${uid}-in`} className="sr-only">
          Ask GRID
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id={`${uid}-in`}
            ref={field}
            value={input}
            rows={2}
            maxLength={LIMITS_HARD}
            placeholder="Ask about his work, or paste a job description…"
            aria-describedby={`${uid}-hint`}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            className="min-h-11 flex-1 resize-none rounded-sm border border-border bg-bg px-3 py-2 text-[15px] text-text placeholder:text-muted hover:border-border-2 focus:border-accent focus:outline-none"
          />
          {busy ? (
            <Button variant="ghost" onClick={() => gridStore.stop()} aria-label="Stop generating">
              Stop
            </Button>
          ) : (
            <Button type="submit" variant="solid" disabled={!input.trim() || tooLong}>
              Ask
            </Button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p
            id={`${uid}-hint`}
            className={cn("font-mono text-[11px]", tooLong ? "text-danger" : "text-muted")}
          >
            {tooLong
              ? `Too long: ${input.length}/${limit} characters.`
              : input.length > limit - 200
                ? `${input.length}/${limit}`
                : "Enter to send · Shift+Enter for a new line"}
          </p>
          {messages.length > 0 ? (
            <span className="flex items-center gap-3">
              <button type="button" onClick={download} className={small}>
                Export
              </button>
              <button
                type="button"
                onClick={() => {
                  gridStore.reset();
                  setInput("");
                }}
                className={small}
              >
                New chat
              </button>
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
