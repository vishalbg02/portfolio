"use client";

import { useEffect } from "react";
import { Toaster, toast } from "sonner";
import type { ToastRequest } from "@/lib/toast";

/**
 * Sonner toaster, styled flat. Lazy-loaded by ToastHost on the first toast;
 * flushes any toasts that were requested while it was loading.
 */
export default function ToasterImpl({ queue, onFlushed }: { queue: ToastRequest[]; onFlushed: () => void }) {
  useEffect(() => {
    if (queue.length === 0) return;
    for (const t of queue) {
      if (t.kind === "success") toast.success(t.message);
      else if (t.kind === "error") toast.error(t.message);
      else toast(t.message);
    }
    onFlushed();
  }, [queue, onFlushed]);

  return (
    <Toaster
      position="bottom-center"
      duration={2500}
      theme="dark"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-[min(360px,calc(100vw-32px))] items-center gap-3 rounded-sm border border-border bg-surface px-4 py-3 font-mono text-sm text-text",
          success: "[&_[data-icon]]:text-accent",
          error: "[&_[data-icon]]:text-danger",
          description: "text-muted",
        },
      }}
    />
  );
}
