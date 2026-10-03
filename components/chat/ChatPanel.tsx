"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/analytics";
import { ChatHttpError, streamChat } from "@/lib/ai/client";
import type { ChatMode, OfflineReason, Source } from "@/lib/ai/protocol";
import { citedNumbers } from "@/lib/ai/sanitize";
import { cn } from "@/lib/utils/cn";
import { AnswerText } from "./AnswerText";

type Msg = {
  id: number;
  role: "user" | "assistant";
  text: string;
  sources: Source[];
  mode?: ChatMode;
  reason?: OfflineReason;
  pending?: boolean;
  error?: string;
};

export const SUGGESTIONS = [
  "What has he built with Spring Boot?",
  "Is he a fit for a full-stack role?",
  "Where is he working now?",
  "How can I contact him?",
];

const MAX = 1000;
const MODE_NOTE: Record<string, string> = {
  offline: "Offline mode — answered straight from this site's content, no AI.",
  refusal: "I only answer questions about Vishal.",
};

/**
 * "Ask Vishal": streaming Q&A grounded in the site's own content, with citations. Works with or
 * without the AI model (offline mode returns the best passages), so it is never a dead end.
 */
export function ChatPanel({
  variant = "inline",
  autoFocus = false,
}: {
  variant?: "inline" | "sheet";
  autoFocus?: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<boolean | null>(null);
  const abort = useRef<AbortController | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(1);
  const hintId = useId();

  useEffect(() => {
    let alive = true;
    fetch("/api/chat")
      .then((r) => r.json())
      .then((j: { ai: boolean }) => alive && setAi(Boolean(j.ai)))
      .catch(() => alive && setAi(false));
    return () => {
      alive = false;
      abort.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (autoFocus) field.current?.focus();
  }, [autoFocus]);

  // keep the newest text in view while streaming (only if the user hasn't scrolled away)
  useEffect(() => {
    const el = log.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 140) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const patch = (id: number, fn: (m: Msg) => Msg) =>
    setMessages((all) => all.map((m) => (m.id === id ? fn(m) : m)));

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy || text.length > MAX) return;
    const history = [...messages.filter((m) => !m.error && m.text), { role: "user" as const, text }]
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.text }));
    const userId = nextId.current++;
    const botId = nextId.current++;
    setMessages((m) => [
      ...m,
      { id: userId, role: "user", text, sources: [] },
      { id: botId, role: "assistant", text: "", sources: [], pending: true },
    ]);
    setInput("");
    setBusy(true);
    track("chat_question");
    abort.current = new AbortController();
    try {
      await streamChat(
        history,
        (e) => {
          if (e.t === "meta")
            patch(botId, (m) => ({ ...m, mode: e.mode, reason: e.reason, sources: e.sources }));
          else if (e.t === "text") patch(botId, (m) => ({ ...m, text: m.text + e.d, pending: false }));
          else if (e.t === "error") patch(botId, (m) => ({ ...m, error: e.message, pending: false }));
          else if (e.t === "done") patch(botId, (m) => ({ ...m, pending: false }));
        },
        abort.current.signal,
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        patch(botId, (m) => ({
          ...m,
          pending: false,
          error: m.text ? "Stopped." : "Stopped before an answer arrived.",
        }));
      } else if (err instanceof ChatHttpError && err.status === 429) {
        const mins = Math.max(1, Math.ceil((err.retryAfterSec ?? 60) / 60));
        patch(botId, (m) => ({
          ...m,
          pending: false,
          error: `You've asked a lot of questions — please try again in about ${mins} minute${mins === 1 ? "" : "s"}, or use the contact section.`,
        }));
      } else if (err instanceof ChatHttpError && err.status === 400) {
        patch(botId, (m) => ({
          ...m,
          pending: false,
          error: "That message couldn't be sent — keep it under 1,000 characters.",
        }));
      } else {
        patch(botId, (m) => ({
          ...m,
          pending: false,
          error: "Couldn't reach the assistant. Check your connection and try again.",
        }));
      }
    } finally {
      setBusy(false);
      abort.current = null;
      field.current?.focus();
    }
  };

  const tooLong = input.length > MAX;
  const empty = messages.length === 0;

  return (
    <div
      className={cn(
        "flex flex-col",
        variant === "sheet" ? "h-full" : "rounded-card border border-border bg-surface",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="flex items-center gap-2 font-mono text-xs text-muted">
          <span
            aria-hidden="true"
            className={cn("size-2 rounded-pill", ai ? "bg-accent" : "border border-muted")}
          />
          {ai === null ? "Checking…" : ai ? "AI online" : "Offline mode"}
        </p>
        {messages.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              abort.current?.abort();
              setMessages([]);
            }}
            className="rounded-sm font-mono text-xs text-muted transition-colors hover:text-text"
          >
            New chat
          </button>
        ) : null}
      </div>

      <div
        ref={log}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label="Conversation with the Ask Vishal assistant"
        className={cn(
          "space-y-5 overflow-y-auto px-4 py-4",
          variant === "sheet" ? "min-h-0 flex-1" : "max-h-[460px] min-h-[220px]",
        )}
      >
        {empty ? (
          <div>
            <p className="text-sm text-muted">
              Ask about his projects, skills, experience or how to reach him. Answers come only from this
              site, with sources.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Suggested questions">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-pill border border-border px-3 py-1.5 text-left text-sm text-text transition-colors hover:border-accent hover:text-accent"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-card border border-border bg-surface-2 px-3.5 py-2.5 text-[15px] whitespace-pre-wrap text-text">
                {m.text}
              </p>
            </div>
          ) : (
            <div key={m.id} className="max-w-[95%]" aria-busy={m.pending}>
              {m.pending && !m.text ? (
                <p className="font-mono text-sm text-muted" role="status">
                  Thinking<span className="animate-blink">…</span>
                </p>
              ) : (
                <AnswerText text={m.text} sources={m.sources} />
              )}
              {m.mode && MODE_NOTE[m.mode] ? (
                <p className="mt-2 font-mono text-[11px] text-muted">{MODE_NOTE[m.mode]}</p>
              ) : null}
              {m.error ? (
                <p role="alert" className="mt-2 text-sm text-danger">
                  {m.error}
                </p>
              ) : null}
              <SourcesRow text={m.text} sources={m.sources} />
            </div>
          ),
        )}
      </div>

      <form
        className="border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <label htmlFor={`${hintId}-input`} className="sr-only">
          Ask a question about Vishal
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id={`${hintId}-input`}
            ref={field}
            value={input}
            rows={2}
            maxLength={MAX + 200}
            placeholder="Ask about his projects, skills or experience…"
            aria-describedby={`${hintId}-hint`}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(input);
              }
            }}
            className="min-h-11 flex-1 resize-none rounded-sm border border-border bg-bg px-3 py-2 text-[15px] text-text placeholder:text-muted hover:border-border-2 focus:border-accent focus:outline-none"
          />
          {busy ? (
            <Button variant="ghost" onClick={() => abort.current?.abort()} aria-label="Stop generating">
              Stop
            </Button>
          ) : (
            <Button type="submit" variant="solid" disabled={!input.trim() || tooLong}>
              Ask
            </Button>
          )}
        </div>
        <p
          id={`${hintId}-hint`}
          className={cn("mt-2 font-mono text-[11px]", tooLong ? "text-danger" : "text-muted")}
        >
          {tooLong
            ? `Too long: ${input.length}/${MAX} characters.`
            : input.length > 800
              ? `${input.length}/${MAX}`
              : "Enter to send · Shift+Enter for a new line"}
        </p>
      </form>
    </div>
  );
}

function SourcesRow({ text, sources }: { text: string; sources: Source[] }) {
  if (sources.length === 0) return null;
  const cited = citedNumbers(text, sources.length);
  const shown = (cited.length > 0 ? cited : sources.slice(0, 2).map((s) => s.n)).map((n) => sources[n - 1]!);
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 font-mono text-[11px] text-muted">
      <span>Sources</span>
      {shown.map((s) => (
        <Link
          key={s.n}
          href={s.url}
          className="rounded-pill border border-border px-2 py-0.5 text-link transition-colors hover:border-border-2"
        >
          [{s.n}] {s.title.length > 42 ? `${s.title.slice(0, 40)}…` : s.title}
        </Link>
      ))}
    </p>
  );
}
