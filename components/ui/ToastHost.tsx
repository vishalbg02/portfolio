"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { TOAST_EVENT, type ToastRequest } from "@/lib/toast";

const ToasterImpl = dynamic(() => import("./ToasterImpl"), { ssr: false });

/** Listens for toast requests and mounts the (code-split) toaster on first use. */
export function ToastHost() {
  const [queue, setQueue] = useState<ToastRequest[]>([]);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastRequest>).detail;
      setActive(true);
      setQueue((q) => [...q, detail]);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  const onFlushed = useCallback(() => setQueue([]), []);

  return active ? <ToasterImpl queue={queue} onFlushed={onFlushed} /> : null;
}
