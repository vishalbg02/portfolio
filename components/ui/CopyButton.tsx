"use client";

import { useEffect, useRef, useState } from "react";
import { track, type AnalyticsEvent } from "@/lib/analytics";
import { copyText } from "@/lib/clipboard";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils/cn";

/** One-click copy with toast + brief "Copied" state. */
export function CopyButton({
  text,
  label,
  noun,
  event,
  className,
}: {
  text: string;
  label: string;
  /** Used in the toast: "<noun> copied". */
  noun: string;
  event?: AnalyticsEvent;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(text)) {
          if (event) track(event);
          toast.success(`${noun} copied`);
          setCopied(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setCopied(false), 1500);
        } else {
          toast.error(`Couldn't copy — ${text}`);
        }
      }}
      className={cn(
        "group flex w-full items-center justify-between gap-4 rounded-sm border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-border-2 hover:bg-surface-2",
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block font-mono text-[11px] tracking-[0.12em] text-muted uppercase">{label}</span>
        <span className="block truncate text-text">{text}</span>
      </span>
      <span
        className={cn(
          "shrink-0 font-mono text-xs",
          copied ? "text-accent" : "text-muted group-hover:text-text",
        )}
      >
        {copied ? "Copied ✓" : "Copy"}
      </span>
    </button>
  );
}
