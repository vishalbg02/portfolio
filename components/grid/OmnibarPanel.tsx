"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildPaletteGroups, type PaletteItem } from "@/components/palette/commands";
import { Kbd } from "@/components/palette/Kbd";
import { BRIEF_PROMPT, MODE_SUGGESTIONS } from "@/lib/ai/modes";
import { openGrid } from "@/lib/grid/events";
import { rankInput } from "@/lib/grid/route-input";
import { GridFace } from "./GridFace";
import { runAction } from "./run-action";

type Row =
  | { id: string; kind: "ask"; label: string; question: string }
  | { id: string; kind: "command"; item: PaletteItem };

const itemClass =
  "flex cursor-pointer items-center justify-between gap-4 rounded-sm px-3 py-2.5 text-sm text-text " +
  "data-[selected=true]:bg-surface-2 data-[selected=true]:text-text";
const headingClass =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 " +
  "[&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:tracking-[0.12em] " +
  "[&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:uppercase";

const clip = (s: string, n = 64) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * The Omnibar's panel: one input for commands and questions. Typing something that is clearly a command ("work",
 * "résumé") makes that the first row; anything else makes "Ask GRID" the first row; `>` shows commands only and
 * `?` asks. Pasting a long text (a job description) goes straight to GRID. Lazy-loaded on first use.
 */
export default function OmnibarPanel({
  open,
  onOpenChange,
  onCloseAutoFocus,
  prefill,
  onReady,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (e: Event) => void;
  /** Whatever was typed before this finished loading, so no key is lost. */
  prefill: string;
  /** Called once the input is on screen (keys typed before that are in `prefill`). */
  onReady?: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-bg/80" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={onCloseAutoFocus}
          className="fixed bottom-5 left-1/2 z-[71] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-card border border-border-2 bg-surface focus:outline-none"
        >
          <Dialog.Title className="sr-only">Ask GRID or run a command</Dialog.Title>
          {/* the content only exists while open, so every opening starts from a clean body */}
          <OmnibarBody prefill={prefill} onClose={() => onOpenChange(false)} onReady={onReady} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function OmnibarBody({
  prefill,
  onClose,
  onReady,
}: {
  prefill: string;
  onClose: () => void;
  onReady?: () => void;
}) {
  const router = useRouter();
  const groups = useMemo(() => buildPaletteGroups(), []);
  const [query, setQuery] = useState(prefill);
  const [picked, setPicked] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // caret after anything typed while this was still loading
    const el = input.current;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
    onReady?.();
  }, [onReady]);

  const ranked = useMemo(() => rankInput(query, groups), [query, groups]);

  const askRows = useMemo<Row[]>(() => {
    if (ranked.ask) {
      return [{ id: "ask:typed", kind: "ask", label: `“${clip(ranked.ask)}”`, question: ranked.ask }];
    }
    if (ranked.commandsOnly) return [];
    return [BRIEF_PROMPT, ...MODE_SUGGESTIONS.default.slice(0, 3)].map((q, i) => ({
      id: `ask:s${i}`,
      kind: "ask" as const,
      label: q,
      question: q,
    }));
  }, [ranked]);

  const commandRows = useMemo(
    () =>
      ranked.groups.map((g) => ({
        heading: g.heading,
        rows: g.items.map<Row>((item) => ({ id: item.id, kind: "command", item })),
      })),
    [ranked],
  );

  const firstId = ranked.askFirst
    ? (askRows[0]?.id ?? commandRows[0]?.rows[0]?.id)
    : (commandRows[0]?.rows[0]?.id ?? askRows[0]?.id);
  // the highlighted row follows the arrow keys; a new query goes back to the first row
  const rowIds = [...askRows.map((r) => r.id), ...commandRows.flatMap((g) => g.rows.map((r) => r.id))];
  const selected = picked && rowIds.includes(picked) ? picked : (firstId ?? "");

  const run = (row: Row) => {
    onClose();
    if (row.kind === "ask") openGrid({ question: row.question });
    else void runAction(row.item.action, router);
  };

  const askGroup =
    askRows.length > 0 ? (
      <Command.Group key="ask" heading="Ask GRID" className={headingClass}>
        {askRows.map((row) => (
          <Command.Item key={row.id} value={row.id} onSelect={() => run(row)} className={itemClass}>
            <span className="flex min-w-0 items-center gap-2.5">
              <span aria-hidden="true" className="font-mono text-accent">
                ?
              </span>
              <span className="truncate">{row.kind === "ask" ? row.label : ""}</span>
            </span>
            {row.id === "ask:typed" ? <span className="font-mono text-xs text-muted">↵ ask</span> : null}
          </Command.Item>
        ))}
      </Command.Group>
    ) : null;

  const commandGroups = commandRows.map((g) => (
    <Command.Group key={g.heading} heading={g.heading} className={headingClass}>
      {g.rows.map((row) =>
        row.kind === "command" ? (
          <Command.Item key={row.id} value={row.id} onSelect={() => run(row)} className={itemClass}>
            <span>{row.item.label}</span>
            {row.item.hint ? (
              <span className="truncate font-mono text-xs text-muted">{row.item.hint}</span>
            ) : null}
          </Command.Item>
        ) : null,
      )}
    </Command.Group>
  ));

  return (
    <Command
      label="Ask GRID or run a command"
      shouldFilter={false}
      loop
      value={selected}
      onValueChange={setPicked}
    >
      <Command.List className="max-h-[min(380px,52vh)] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center font-mono text-sm text-muted">
          No command matches. Remove the &gt; to ask GRID instead.
        </Command.Empty>
        {ranked.askFirst ? (
          <>
            {askGroup}
            {commandGroups}
          </>
        ) : (
          <>
            {commandGroups}
            {askGroup}
          </>
        )}
      </Command.List>
      <div className="flex items-center gap-3 border-t border-border px-4">
        <GridFace state={query.trim() ? "listening" : "idle"} size={22} label="" />
        <Command.Input
          ref={input}
          autoFocus
          value={query}
          onValueChange={(v) => {
            setQuery(v);
            setPicked(null);
          }}
          placeholder="Ask GRID, or type > for commands"
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            // a pasted job description (or any long text) cannot live in a one-line field: hand it to GRID
            if (text.length > 240 || text.includes("\n")) {
              e.preventDefault();
              onClose();
              openGrid({ question: text.trim() });
            }
          }}
          className="h-12 w-full bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2 font-mono text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> move
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>↵</Kbd> run
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>&gt;</Kbd> commands
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>esc</Kbd> close
        </span>
      </div>
    </Command>
  );
}
