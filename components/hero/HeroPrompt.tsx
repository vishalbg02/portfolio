"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { performAction } from "@/components/terminal/perform";
import { track } from "@/lib/analytics";
import type { Line } from "@/lib/terminal/commands";
import { applyTab, historyStep } from "@/lib/terminal/input";
import { cn } from "@/lib/utils/cn";
import { unlock } from "@/lib/achievements";

type Entry = { id: number; command: string; lines: Line[] };
type Engine = typeof import("@/lib/terminal/commands");

const USED_KEY = "hero-terminal-used";
const tone: Record<NonNullable<Line["tone"]>, string> = {
  accent: "text-accent",
  muted: "text-muted",
  error: "text-danger",
};

/**
 * The live prompt at the bottom of the hero terminal. Until hydration it is a static `$ ▮` line of the
 * same height (so nothing shifts); afterwards it is a real input. The command engine is a separate chunk,
 * fetched on first focus/keypress, and is the same one the full-screen terminal uses.
 */
export function HeroPrompt() {
  const router = useRouter();
  // false on the server and during hydration, true afterwards: no setState-in-effect, no mismatch
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const usedBefore = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return Boolean(localStorage.getItem(USED_KEY));
      } catch {
        return false; // storage blocked: the hint simply stays
      }
    },
    () => false,
  );
  const [value, setValue] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [usedNow, setUsedNow] = useState(false);
  const engine = useRef<Promise<Engine> | null>(null);
  const history = useRef<string[]>([]);
  const cursor = useRef<number | null>(null);
  const nextId = useRef(1);
  const logEnd = useRef<HTMLDivElement>(null);

  const load = () => (engine.current ??= import("@/lib/terminal/commands"));

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "nearest" });
  }, [entries]);

  const submit = async () => {
    const command = value.trim();
    setValue("");
    cursor.current = null;
    if (!command) return;
    history.current = [...history.current, command];
    setUsedNow(true);
    try {
      localStorage.setItem(USED_KEY, "1");
    } catch {
      /* ignore */
    }
    const { run, COMMAND_NAMES } = await load();
    const first = command.split(/\s+/)[0]!.toLowerCase();
    unlock("command");
    track("hero_terminal_command", { command: COMMAND_NAMES.includes(first) ? first : "unknown" });
    const result = run(command);
    if (result.egg) track("easter_egg_found", { name: result.egg });
    if (result.action?.type !== "clear") {
      setEntries((e) => [...e.slice(-6), { id: nextId.current++, command, lines: result.lines }]);
    }
    if (result.action) {
      performAction(result.action, {
        navigate: (href) => router.push(href),
        clear: () => setEntries([]),
        exit: () => {},
      });
    }
  };

  const onKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const step = historyStep(history.current, cursor.current, e.key === "ArrowUp" ? "up" : "down");
      cursor.current = step.cursor;
      setValue(step.value);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const { complete } = await load();
      const { value: next, listed } = applyTab(value, complete(value));
      setValue(next);
      if (listed.length > 0) {
        setEntries((en) => [
          ...en.slice(-6),
          { id: nextId.current++, command: value, lines: [{ text: listed.join("  "), tone: "muted" }] },
        ]);
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setEntries([]);
    }
  };

  return (
    <div className="term-late">
      {entries.length > 0 ? (
        <div
          role="log"
          aria-live="polite"
          aria-label="Terminal output"
          className="mt-3 max-h-44 overflow-y-auto border-t border-border pt-3"
        >
          {entries.map((en) => (
            <div key={en.id} className="mb-2">
              <p className="text-text">
                <span aria-hidden="true" className="text-accent">
                  ${" "}
                </span>
                {en.command}
              </p>
              {en.lines.map((l, i) => {
                const cls = cn("break-words whitespace-pre-wrap", l.tone ? tone[l.tone] : "text-muted");
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
          <div ref={logEnd} />
        </div>
      ) : null}

      <div className="mt-3 flex h-6 items-center gap-2 text-text">
        <span aria-hidden="true" className="text-accent">
          $
        </span>
        {ready ? (
          <form
            className="min-w-0 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <input
              id="hero-term-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() => void load()}
              aria-label="Terminal command"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              maxLength={300}
              className="h-6 w-full min-w-0 bg-transparent font-mono text-sm text-text caret-accent focus:outline-none pointer-coarse:h-11"
            />
          </form>
        ) : (
          <span aria-hidden="true" className="inline-block h-4 w-2 animate-blink bg-accent" />
        )}
      </div>

      {!usedBefore && !usedNow ? (
        <p className="mt-2 text-xs text-muted">
          try: <code className="text-text">help</code>
        </p>
      ) : null}
    </div>
  );
}
