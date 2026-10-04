"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile, only when a site key is configured at build time (NEXT_PUBLIC_TURNSTILE_SITE_KEY). The script
 * is fetched when this first appears, which is when someone starts a chat, never on page load. Without a key this
 * renders nothing and the honeypot, rate limits and caps are what protect the chat.
 */
type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id?: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
export const turnstileEnabled = SITE_KEY !== "";

let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile failed to load"));
    document.head.appendChild(s);
  });
  return loading;
}

export function Turnstile({
  onToken,
  resetKey,
}: {
  onToken: (token: string | null) => void;
  resetKey?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const cb = useRef(onToken);
  useEffect(() => {
    cb.current = onToken;
  });

  useEffect(() => {
    if (!turnstileEnabled || !box.current) return;
    let alive = true;
    void loadScript()
      .then(() => {
        if (!alive || !box.current || !window.turnstile) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey: SITE_KEY,
          theme: "dark",
          callback: (t: string) => cb.current(t),
          "expired-callback": () => cb.current(null),
          "error-callback": () => cb.current(null),
        });
      })
      .catch(() => cb.current(null));
    return () => {
      alive = false;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
    };
  }, []);

  useEffect(() => {
    if (resetKey && widget.current && window.turnstile) window.turnstile.reset(widget.current);
  }, [resetKey]);

  return turnstileEnabled ? <div ref={box} className="min-h-[65px]" aria-label="Bot check" /> : null;
}
