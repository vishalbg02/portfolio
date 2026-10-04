"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ACH_EVENT } from "@/lib/achievements";
import { clearToken, readToken, saveToken, takeFromUrl } from "@/lib/links/session";

const CompanyBanner = dynamic(() => import("./CompanyBanner"), { ssr: false });

export const CHAT_STARTED_EVENT = "app:chat-started";

const send = (token: string, e: "resume" | "chat") => {
  const key = `link:sent:${e}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* blocked: the server still limits it to one ping an hour */
  }
  void fetch("/api/link/event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ c: token, e }),
    keepalive: true,
  }).catch(() => {});
};

/**
 * Always mounted and tiny. Without a personal link it does nothing at all (nothing is fetched). With one (`?c=…`, kept for
 * the tab) it loads the banner, and tells Vishal when this visitor downloads the résumé or starts a chat with GRID.
 */
export function CompanyLinkHost() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = takeFromUrl() ?? readToken();
    if (!t) return;
    saveToken(t);
    const show = window.setTimeout(() => setToken(t), 0);
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest('a[href$="/resume.pdf"], a[data-track="resume_download"]'))
        send(t, "resume");
    };
    const onAch = (e: Event) => {
      if ((e as CustomEvent<{ id: string }>).detail?.id === "grid") send(t, "chat");
    };
    const onChat = () => send(t, "chat");
    document.addEventListener("click", onClick, true);
    window.addEventListener(ACH_EVENT, onAch);
    window.addEventListener(CHAT_STARTED_EVENT, onChat);
    return () => {
      window.clearTimeout(show);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(ACH_EVENT, onAch);
      window.removeEventListener(CHAT_STARTED_EVENT, onChat);
    };
  }, []);

  return token ? (
    <CompanyBanner
      token={token}
      onGone={() => {
        clearToken();
        setToken(null);
      }}
    />
  ) : null;
}
