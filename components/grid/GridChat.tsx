"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { LANGS, LANG_LABEL, type Lang } from "@/lib/ai/lang";
import { MODE_LABEL, MODE_SUGGESTIONS, BRIEF_PROMPT, availableModes } from "@/lib/ai/modes";
import type { ChatMode } from "@/lib/ai/protocol";
import { inputLimit } from "@/lib/ai/agent/jd";
import { TOOL_DONE, TOOL_WORKING } from "@/lib/grid/demo";
import { gridStore, type Msg } from "@/lib/grid/store";
import { toTranscript } from "@/lib/grid/export";
import { useGridStore } from "@/lib/grid/use-store";
import { copyText } from "@/lib/clipboard";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils/cn";
import { AnswerText } from "./AnswerText";
import { PartView } from "./cards/PartView";
import { GridFace, type FaceState } from "./GridFace";
import { SourcesRow } from "./SourcesRow";
import { usePresence } from "@/lib/live/use-presence";
import { useVoice } from "./voice/useVoice";
import { emitFace } from "@/lib/grid/stages";

/** What a screen reader hears when GRID's state changes (politely, once per change). */
const FACE_SAY: Record<FaceState, string> = {
  idle: "",
  listening: "",
  thinking: "GRID is thinking…",
  acting: "GRID is using a tool…",
  speaking: "GRID is answering…",
};

const MODE_NOTE: Partial<Record<ChatMode, string>> = {
  offline: "Offline mode — answered straight from this site's content, no AI.",
  refusal: "I only answer questions about Vishal.",
};

/** Stops a runaway paste in the field itself; the real limit is `inputLimit`. */
const LIMITS_HARD = 7_000;

const chip =
  "inline-flex min-h-8 items-center rounded-pill border border-border px-3 text-left text-sm text-text transition-colors hover:border-accent hover:text-accent pointer-coarse:min-h-11";

export function faceFor(
  busy: boolean,
  last: Msg | undefined,
  typing: boolean,
  voice: { listening?: boolean; speaking?: boolean } = {},
): FaceState {
  if (voice.listening) return "listening";
  if (voice.speaking) return "speaking";
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
  onLive,
}: {
  variant: "inline" | "sheet";
  autoFocus?: boolean;
  /** Extra header buttons (close, dock …) supplied by the sheet. */
  controls?: ReactNode;
  /** Called when a cited source is used, so a modal sheet can close and let the page scroll. */
  onJump?: () => void;
  /** Opens "Message Vishal" (the live chat) in the same panel. */
  onLive?: () => void;
}) {
  const { messages, mode, lang, busy, ai } = useGridStore();
  const presence = usePresence();
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const uid = useId();
  const last = messages.at(-1);
  const empty = messages.length === 0;
  const inline = variant === "inline";
  const limit = inputLimit(input);
  const tooLong = input.length > limit;

  useEffect(() => {
    if (autoFocus) field.current?.focus();
  }, [autoFocus]);

  // Keep the newest text in view while streaming, unless the visitor has scrolled up to read. "Stuck to the bottom"
  // is remembered from scroll events: measuring after the content grew would call a tall new card "scrolled up".
  const stuck = useRef(true);
  const inner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = log.current;
    if (el && stuck.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Cards that load lazily (a diagram, a job match) grow after they appear: keep following the bottom while stuck to it.
  useEffect(() => {
    const content = inner.current;
    const scroller = log.current;
    if (!content || !scroller || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (stuck.current) scroller.scrollTop = scroller.scrollHeight;
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  const ask = (q: string) => {
    voice.stopSpeaking();
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

  // Dictation fills this same box (so what was heard is visible and editable) and is never sent by itself.
  const dictated = useRef("");
  const onTranscript = useCallback(
    (t: string) => setInput(`${dictated.current}${dictated.current && t ? " " : ""}${t}`.slice(0, 7_000)),
    [],
  );
  const voice = useVoice(lang, onTranscript);
  const wasBusy = useRef(false);
  const { speak, speakOn } = voice;
  useEffect(() => {
    // Read an answer aloud the moment it finishes, only if the speaker is on. Turning the speaker on does not read the
    // previous answer: it only affects the next one.
    const finished = wasBusy.current && !busy;
    wasBusy.current = busy;
    if (!finished || !speakOn || !last || last.role !== "assistant" || !last.text || last.error) return;
    speak(last.text);
  }, [busy, last, speak, speakOn]);

  const face = faceFor(busy, last, focused && input.length > 0, {
    listening: voice.listening,
    speaking: voice.speaking,
  });
  // every GRID face on the page (Omnibar, puck, dock, the Meet GRID stage) mirrors this one
  useEffect(() => emitFace(face), [face]);
  const small =
    "shrink-0 rounded-sm font-mono text-xs whitespace-nowrap text-muted transition-colors hover:text-text pointer-coarse:min-h-11 pointer-coarse:px-2";

  return (
    <div
      className={cn(
        "flex flex-col",
        variant === "sheet" ? "h-full" : "rounded-card border border-border bg-surface",
      )}
    >
      <div className="relative flex items-center gap-3 border-b border-border px-4 py-3">
        {busy ? (
          <span aria-hidden="true" className="grid-activity">
            <span />
          </span>
        ) : null}
        <GridFace state={face} size={36} label={`GRID is ${face === "idle" ? "ready" : face}`} />
        <span aria-live="polite" aria-atomic="true" className="sr-only">
          {FACE_SAY[face]}
        </span>
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
        {voice.support.speak ? (
          <button
            type="button"
            aria-pressed={voice.speakOn}
            aria-label={voice.speakOn ? "Mute spoken replies" : "Speak replies aloud"}
            title={voice.speakOn ? "Spoken replies on: press to mute" : "Speak replies aloud"}
            onClick={voice.toggleSpeak}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-sm border text-muted transition-colors hover:border-border-2 hover:text-text pointer-coarse:size-11",
              voice.speakOn ? "border-accent text-accent" : "border-border",
            )}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 5h2.5L8 2.5v9L4.5 9H2z" fill="currentColor" />
              {voice.speakOn ? (
                <path d="M10 4.5c1 1.4 1 3.6 0 5" stroke="currentColor" strokeWidth="1.3" />
              ) : (
                <path d="M10 5l3 4M13 5l-3 4" stroke="currentColor" strokeWidth="1.3" />
              )}
            </svg>
          </button>
        ) : null}
        {controls}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => ask(BRIEF_PROMPT)}
            className="inline-flex min-h-8 items-center rounded-pill border border-accent px-3 font-mono text-xs whitespace-nowrap text-accent transition-colors hover:bg-accent hover:text-bg disabled:opacity-50 pointer-coarse:min-h-11"
          >
            {BRIEF_PROMPT}
          </button>
          {onLive ? (
            <button
              type="button"
              onClick={onLive}
              className="inline-flex min-h-8 items-center gap-2 rounded-pill border border-border-2 px-3 font-mono text-xs whitespace-nowrap text-text transition-colors hover:border-accent hover:text-accent pointer-coarse:min-h-11"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 rounded-pill",
                  presence?.configured && presence.state === "online" ? "bg-accent" : "border border-muted",
                )}
              />
              Message Vishal
              <span className="sr-only">
                {presence?.configured ? `: ${presence.state === "online" ? "online" : "away"}` : ""}
              </span>
            </button>
          ) : null}
        </div>
        <div
          role="group"
          aria-label="Mode"
          className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-pill border border-border p-0.5"
        >
          {availableModes().map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => gridStore.setMode(m)}
              className={cn(
                "inline-flex min-h-7 shrink-0 items-center rounded-pill px-3 font-mono text-xs whitespace-nowrap transition-colors pointer-coarse:min-h-11",
                mode === m ? "bg-surface-2 text-text" : "text-muted hover:text-text",
              )}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
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
          "overflow-y-auto px-4 py-4",
          // inline, the log has one fixed height whatever it holds, so the section never moves as a chat runs
          variant === "sheet" ? "min-h-0 flex-1" : "h-[360px]",
        )}
      >
        <div ref={inner} className={cn("space-y-5", inline && "mx-auto max-w-[720px]")}>
          {empty ? (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                I&apos;m GRID, Vishal&apos;s AI. Ask about his work, skills or experience (answers come only
                from this site, with sources), or ask me to show you something: a project, an architecture
                diagram, where he used a skill. Paste a job description and I&apos;ll match it.
              </p>
              <ul
                className={cn(inline ? "grid gap-2 sm:grid-cols-2" : "flex flex-wrap gap-2")}
                aria-label="Suggested questions"
              >
                {MODE_SUGGESTIONS[mode].map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => ask(s)}
                      className={cn(chip, inline && "min-h-11 w-full rounded-card px-3.5 py-2 leading-snug")}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
              {inline ? (
                <p className="font-mono text-[11px] text-muted max-sm:hidden pointer-coarse:hidden">
                  Press <kbd className="font-mono text-text">/</kbd> anywhere to ask.
                </p>
              ) : null}
            </div>
          ) : null}

          {messages.map((m, i) => {
            if (m.role === "user")
              return (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-card border border-border bg-surface-2 px-3.5 py-2.5 text-[15px] whitespace-pre-wrap text-text">
                    {m.text}
                  </p>
                </div>
              );
            const live = i === messages.length - 1 && busy;
            return (
              <div key={m.id} className="flex max-w-[98%] items-start gap-2.5" aria-busy={m.pending}>
                <GridFace
                  state={live ? face : "idle"}
                  still={!live}
                  size={24}
                  className="mt-0.5 max-sm:hidden"
                />
                <div className="min-w-0 flex-1 space-y-3">
                  {m.tools.map((t) =>
                    t.state === "running" ? (
                      <p key={t.id} role="status" className="font-mono text-xs text-muted">
                        <span aria-hidden="true" className="mr-2 text-accent">
                          ▸
                        </span>
                        {TOOL_WORKING[t.name]}
                        <span className="animate-blink">…</span>
                      </p>
                    ) : t.state === "done" ? (
                      <p key={t.id} className="font-mono text-[11px] text-muted">
                        <span aria-hidden="true" className="mr-2 text-accent">
                          ✓
                        </span>
                        {TOOL_DONE[t.name]}
                      </p>
                    ) : null,
                  )}
                  {m.parts.map((p) => (
                    <PartView
                      key={p.id}
                      part={p.part}
                      done={p.done}
                      onResolve={(d) => gridStore.resolvePart(m.id, p.id, d)}
                      onAsk={busy ? undefined : ask}
                    />
                  ))}
                  {m.pending &&
                  !m.text &&
                  m.tools.every((t) => t.state !== "running") &&
                  m.parts.length === 0 ? (
                    <p className="font-mono text-sm text-muted" role="status">
                      Thinking<span className="animate-blink">…</span>
                    </p>
                  ) : m.text ? (
                    <AnswerText text={m.text} sources={m.sources} streaming={Boolean(m.pending)} />
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
                  {m.text && !m.pending && !m.error ? (
                    <button
                      type="button"
                      onClick={async () =>
                        (await copyText(m.text)) ? toast.success("Copied") : toast.error("Couldn't copy")
                      }
                      className={cn(small, "-ml-1 inline-flex items-center gap-1.5 px-1")}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" />
                        <path
                          d="M8 4V2.5A1.5 1.5 0 0 0 6.5 1h-4A1.5 1.5 0 0 0 1 2.5v4A1.5 1.5 0 0 0 2.5 8H4"
                          stroke="currentColor"
                        />
                      </svg>
                      Copy answer
                    </button>
                  ) : null}
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
              </div>
            );
          })}
        </div>
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
        <div className="flex items-end gap-2 rounded-card border border-border bg-bg p-2 transition-colors focus-within:border-accent hover:border-border-2 focus-within:hover:border-accent">
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
            className="min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-text placeholder:text-muted focus:outline-none"
          />
          {voice.support.listen ? (
            <button
              type="button"
              aria-pressed={voice.listening}
              aria-label={voice.listening ? "Stop dictation" : "Speak your question"}
              title={voice.listening ? "Listening: press to stop" : "Speak your question"}
              onClick={() => {
                if (voice.listening) voice.stopListening();
                else {
                  dictated.current = input.trim();
                  voice.startListening();
                }
              }}
              className={cn(
                "inline-flex size-11 shrink-0 items-center justify-center rounded-sm border transition-colors",
                voice.listening
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:border-border-2 hover:text-text",
              )}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect
                  x="6"
                  y="1.5"
                  width="4"
                  height="8"
                  rx="2"
                  fill={voice.listening ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
                <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.5" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </button>
          ) : null}
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
        {voice.listening || voice.speaking || voice.note ? (
          <p role="status" className="mt-2 font-mono text-[11px] text-muted">
            {voice.listening
              ? "Listening… press the microphone to stop. Check the text, then send."
              : voice.speaking
                ? "Speaking. Press the speaker to mute."
                : voice.note}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <p
            id={`${uid}-hint`}
            className={cn(
              "font-mono text-[11px]",
              tooLong ? "text-danger" : "text-muted max-sm:hidden pointer-coarse:hidden",
            )}
          >
            {tooLong
              ? `Too long: ${input.length}/${limit} characters.`
              : input.length > limit - 200
                ? `${input.length}/${limit}`
                : "Enter to send · Shift+Enter for a new line"}
          </p>
          <span className="flex items-center gap-3 max-sm:w-full max-sm:justify-between">
            <label className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
              Reply in
              <select
                aria-label="Reply language"
                value={lang}
                onChange={(e) => gridStore.setLang(e.target.value as Lang)}
                className="min-h-7 cursor-pointer rounded-sm border border-border bg-bg px-1.5 font-mono text-[11px] text-text hover:border-border-2 focus-visible:border-accent pointer-coarse:min-h-11"
              >
                {LANGS.map((l) => (
                  <option key={l} value={l} lang={l === "kn" ? "kn" : l === "hi" ? "hi" : undefined}>
                    {LANG_LABEL[l]}
                  </option>
                ))}
              </select>
            </label>
            {messages.length > 0 ? (
              <span className="flex items-center gap-3">
                <button type="button" onClick={download} className={small}>
                  Export
                </button>
                <button
                  type="button"
                  onClick={() => {
                    voice.stopSpeaking();
                    gridStore.reset();
                    setInput("");
                  }}
                  className={small}
                >
                  New chat
                </button>
              </span>
            ) : null}
          </span>
        </div>
      </form>
    </div>
  );
}
