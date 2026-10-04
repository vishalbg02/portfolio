"use client";

import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { COMMAND_NAMES, complete, run, type Line, type TerminalAction } from "@/lib/terminal/commands";
import { applyTab, historyStep } from "@/lib/terminal/input";
import { cn } from "@/lib/utils/cn";
import { performAction } from "./perform";
import { useRevealRef } from "@/lib/fx/use-reveal";
import { unlock } from "@/lib/achievements";
import { play } from "@/lib/sound";

type Entry = { id: number; command: string | null; lines: Line[] };

const BANNER: Line[] = [
  { text: "vishalbg shell — type help to see what it can do.", tone: "accent" },
  { text: `Try: ${COMMAND_NAMES.slice(0, 5).join(", ")}…`, tone: "muted" },
];

const tone: Record<NonNullable<Line["tone"]>, string> = {
  accent: "text-accent",
  muted: "text-muted",
  error: "text-danger",
};

/** The terminal itself (Radix Dialog). Lazy-loaded the first time it is opened. */
export default function TerminalDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([{ id: 0, command: null, lines: BANNER }]);
  const [value, setValue] = useState("");
  const history = useRef<string[]>([]);
  const cursor = useRef<number | null>(null);
  const nextId = useRef(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [entries]);

  const perform = (action: TerminalAction) =>
    performAction(action, {
      navigate: (href) => router.push(href),
      clear: () => setEntries([]),
      exit: () => onOpenChange(false),
      beforeOverlay: () => onOpenChange(false),
    });

  const submit = () => {
    const command = value;
    setValue("");
    cursor.current = null;
    if (command.trim()) {
      history.current = [...history.current, command];
      unlock("command");
    }
    const result = run(command);
    if (result.egg) track("easter_egg_found", { name: result.egg });
    if (result.action?.type !== "clear") {
      setEntries((e) => [...e, { id: nextId.current++, command, lines: result.lines }]);
    }
    if (result.action) perform(result.action);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key.length === 1 || e.key === "Backspace") play("tick");
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const step = historyStep(history.current, cursor.current, e.key === "ArrowUp" ? "up" : "down");
      cursor.current = step.cursor;
      setValue(step.value);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const { value: next, listed } = applyTab(value, complete(value));
      setValue(next);
      if (listed.length > 0) {
        setEntries((en) => [
          ...en,
          { id: nextId.current++, command: value, lines: [{ text: listed.join("  "), tone: "muted" }] },
        ]);
      }
    } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      setEntries([]);
    }
  };

  const revealRef = useRevealRef<HTMLDivElement>();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-bg/80" />
        <Dialog.Content
          ref={revealRef}
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-x-3 top-[8vh] bottom-3 z-[71] mx-auto flex max-w-3xl flex-col overflow-hidden rounded-card border border-border bg-bg focus:outline-none sm:inset-x-6 sm:bottom-auto sm:h-[min(560px,80vh)]"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <Dialog.Title className="font-mono text-xs tracking-[0.12em] text-muted uppercase">
              <span className="mr-2 text-accent">&gt;_</span>Terminal
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close terminal"
              className="inline-flex size-8 items-center justify-center rounded-sm border border-border text-muted hover:border-border-2 hover:text-text"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </Dialog.Close>
          </div>

          <div
            role="log"
            aria-live="polite"
            aria-label="Terminal output"
            className="min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-[13px] leading-relaxed"
            onClick={() => inputRef.current?.focus()}
          >
            {entries.map((en) => (
              <div key={en.id} className="mb-2">
                {en.command !== null ? (
                  <p className="text-text">
                    <span aria-hidden="true" className="text-accent">
                      ${" "}
                    </span>
                    {en.command}
                  </p>
                ) : null}
                {en.lines.map((l, i) => {
                  const cls = cn("break-words whitespace-pre-wrap", l.tone ? tone[l.tone] : "text-text");
                  return l.href ? (
                    <p key={i} className={cls}>
                      <a
                        href={l.href}
                        target={l.href.startsWith("http") ? "_blank" : undefined}
                        rel="noopener noreferrer"
                        className="text-link underline underline-offset-2"
                      >
                        {l.text}
                      </a>
                    </p>
                  ) : (
                    <p key={i} className={cls}>
                      {l.text}
                    </p>
                  );
                })}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex items-center gap-2 border-t border-border px-4 py-3 font-mono text-[13px]"
          >
            <span aria-hidden="true" className="text-accent">
              $
            </span>
            <input
              id="terminal-input"
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label="Terminal command"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              placeholder="type help"
              className="min-w-0 flex-1 bg-transparent text-text placeholder:text-muted focus:outline-none"
            />
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
