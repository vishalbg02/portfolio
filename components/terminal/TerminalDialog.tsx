"use client";

import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { copyText } from "@/lib/clipboard";
import { openCosmoStrike } from "@/lib/delight";
import { toast } from "@/lib/toast";
import {
  COMMAND_NAMES,
  commonPrefix,
  complete,
  run,
  type Line,
  type TerminalAction,
} from "@/lib/terminal/commands";
import { OPEN_CHAT_EVENT } from "@/components/chat/ChatLauncher";
import { cn } from "@/lib/utils/cn";

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

  const perform = (action: TerminalAction) => {
    switch (action.type) {
      case "clear":
        setEntries([]);
        break;
      case "exit":
        onOpenChange(false);
        break;
      case "navigate":
        onOpenChange(false);
        router.push(action.href);
        break;
      case "external":
        window.open(action.href, "_blank", "noopener,noreferrer");
        break;
      case "download": {
        const a = document.createElement("a");
        a.href = action.href;
        a.download = action.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        track("resume_download");
        break;
      }
      case "copy":
        void copyText(action.text).then((ok) => {
          if (ok) {
            toast.success(`${action.label} copied`);
            track(action.label === "Email" ? "copy_email" : "copy_phone");
          } else toast.error(`Couldn't copy — ${action.text}`);
        });
        break;
      case "game":
        onOpenChange(false);
        window.setTimeout(openCosmoStrike, 150);
        break;
      case "ask":
        onOpenChange(false);
        window.setTimeout(() => window.dispatchEvent(new Event(OPEN_CHAT_EVENT)), 150);
        break;
    }
  };

  const submit = () => {
    const command = value;
    setValue("");
    cursor.current = null;
    if (command.trim()) history.current = [...history.current, command];
    const result = run(command);
    if (result.egg) track("easter_egg_found", { name: result.egg });
    if (result.action?.type !== "clear") {
      setEntries((e) => [...e, { id: nextId.current++, command, lines: result.lines }]);
    }
    if (result.action) perform(result.action);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const h = history.current;
      if (h.length === 0) return;
      const cur = cursor.current ?? h.length;
      const next = Math.min(h.length, Math.max(0, cur + (e.key === "ArrowUp" ? -1 : 1)));
      cursor.current = next === h.length ? null : next;
      setValue(next === h.length ? "" : h[next]!);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const options = complete(value);
      if (options.length === 0) return;
      const words = value.split(/\s+/);
      const prefix = commonPrefix(options);
      words[words.length - 1] = prefix;
      setValue(words.join(" ") + (options.length === 1 ? " " : ""));
      if (options.length > 1) {
        setEntries((en) => [
          ...en,
          { id: nextId.current++, command: value, lines: [{ text: options.join("  "), tone: "muted" }] },
        ]);
      }
    } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      setEntries([]);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-bg/80" />
        <Dialog.Content
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
