"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useMemo } from "react";
import { track } from "@/lib/analytics";
import { copyText } from "@/lib/clipboard";
import { toast } from "@/lib/toast";
import { Kbd } from "./Kbd";
import { buildPaletteGroups, type PaletteAction } from "./commands";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (e: Event) => void;
};

const itemClass =
  "flex cursor-pointer items-center justify-between gap-4 rounded-sm px-3 py-2.5 text-sm text-text " +
  "data-[selected=true]:bg-surface-2 data-[selected=true]:text-text";

/** ⌘K command palette. Keyboard-only: arrows move, Enter runs, Esc closes. Lazy-loaded. */
export default function PaletteImpl({ open, onOpenChange, onCloseAutoFocus }: Props) {
  const router = useRouter();
  const groups = useMemo(() => buildPaletteGroups(), []);

  const run = async (action: PaletteAction) => {
    onOpenChange(false);
    switch (action.type) {
      case "route":
        router.push(action.href);
        break;
      case "external":
        if (action.event) track(action.event);
        window.open(action.href, "_blank", "noopener,noreferrer");
        break;
      case "download":
        if (action.event) track(action.event);
        window.location.assign(action.href);
        break;
      case "tel":
        window.location.assign(action.href);
        break;
      case "copy": {
        const ok = await copyText(action.text);
        if (ok) {
          if (action.event) track(action.event);
          toast.success(`${action.label} copied`);
        } else {
          toast.error(`Couldn't copy — ${action.text}`);
        }
        break;
      }
      case "event":
        window.dispatchEvent(new Event(`app:${action.name}`));
        break;
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-bg/80" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={onCloseAutoFocus}
          className="fixed top-[12vh] left-1/2 z-[71] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-card border border-border bg-surface focus:outline-none"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Command label="Command palette" loop>
            <div className="flex items-center gap-3 border-b border-border px-4">
              <span aria-hidden="true" className="font-mono text-sm text-accent">
                &gt;_
              </span>
              <Command.Input
                autoFocus
                placeholder="Type a command or search…"
                className="h-12 w-full bg-transparent font-mono text-sm text-text placeholder:text-muted focus:outline-none"
              />
            </div>
            <Command.List className="max-h-[min(360px,55vh)] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center font-mono text-sm text-muted">
                No results.
              </Command.Empty>
              {groups.map((group) => (
                <Command.Group
                  key={group.heading}
                  heading={group.heading}
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:uppercase"
                >
                  {group.items.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={`${item.label} ${(item.keywords ?? []).join(" ")}`}
                      onSelect={() => void run(item.action)}
                      className={itemClass}
                    >
                      <span>{item.label}</span>
                      {item.hint ? (
                        <span className="truncate font-mono text-xs text-muted">{item.hint}</span>
                      ) : null}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
            <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 font-mono text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> navigate
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>↵</Kbd> select
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>esc</Kbd> close
              </span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
