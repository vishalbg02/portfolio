"use client";

import { useMinute } from "@/lib/hooks/use-minute";
import { cn } from "@/lib/utils/cn";

const formatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** Live Bengaluru time, e.g. "11:42 PM IST". Fixed-width placeholder until mounted (no CLS). */
export function LocalTime({ className }: { className?: string }) {
  const now = useMinute();
  const text = now === null ? "--:-- --" : formatter.format(now).toUpperCase();
  return (
    <span data-visual-mask className={cn("inline-block min-w-[8ch] font-mono font-tabular", className)}>
      <time dateTime={now === null ? undefined : new Date(now).toISOString()} suppressHydrationWarning>
        {text}
      </time>{" "}
      IST
    </span>
  );
}
