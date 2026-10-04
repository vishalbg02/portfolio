"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { inputLimit } from "@/lib/ai/agent/jd";
import { ACT_EVENT, OPEN_GRID_EVENT, OPEN_LIVE_EVENT, workGo, type OpenGridDetail } from "@/lib/grid/events";
import { parseThreadParam, saveSession } from "@/lib/live/session";
import { flashProof, jumpTarget } from "@/lib/proof";
import type { UiPart } from "@/lib/ai/protocol";
import { SelectionAsk } from "./SelectionAsk";

const loadSheet = () => import("./GridSheet");
const GridSheet = dynamic(loadSheet, { ssr: false });

const fit = (q: string) => q.slice(0, inputLimit(q));

/**
 * Always mounted, tiny. It opens GRID's panel (a window event, or any element marked `data-grid-open`), carries out
 * what GRID does on the page (take you somewhere, open a project's walkthrough), and lets everything else load
 * only when it is first needed: the panel, the conversation store, the chat.
 */
export function GridHost() {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<"grid" | "live">("grid");
  const [prefill, setPrefill] = useState<string | undefined>();
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const wide = () => window.matchMedia("(min-width: 768px)").matches;

    const onOpen = async (e: Event) => {
      const d = ((e as CustomEvent<OpenGridDetail>).detail ?? {}) as OpenGridDetail;
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) opener.current = active;
      setMounted(true);
      setView("grid");
      setOpen(true);
      const { gridStore } = await import("@/lib/grid/store");
      gridStore.hydrate();
      void gridStore.checkAi();
      if (d.mode) gridStore.setMode(d.mode);
      if (d.question?.trim()) void gridStore.send(fit(d.question), { project: d.project });
    };

    /** "Message Vishal": the same panel, on the live chat. */
    const onLive = (e: Event) => {
      const d = (e as CustomEvent<{ prefill?: string }>).detail;
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) opener.current = active;
      setPrefill(d?.prefill?.slice(0, 1500));
      setMounted(true);
      setView("live");
      setOpen(true);
    };

    /** What GRID did: move the visitor. On a phone the full-screen chat steps away first so they can see it. */
    const onAct = (e: Event) => {
      const part = (e as CustomEvent<{ part: UiPart }>).detail?.part;
      if (!part || (part.kind !== "navigate" && part.kind !== "demo")) return;
      const reveal = wide() ? 0 : 160;
      if (!wide()) setOpen(false);
      window.setTimeout(() => {
        if (part.kind === "demo") {
          if (pathRef.current === "/") workGo(part.slug, part.beat ?? undefined);
          else router.push(`/work/${part.slug}`);
          return;
        }
        const t = jumpTarget(part.href, pathRef.current);
        if (t.type === "scroll") flashProof(t.id);
        else if (t.href === pathRef.current) window.scrollTo({ top: 0, behavior: "smooth" });
        else router.push(t.href);
      }, reveal);
    };

    // Links like <a href="/#ask" data-grid-open data-grid-question="…">: JS opens the panel, no JS follows the href.
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const el = (e.target as Element | null)?.closest<HTMLElement>("[data-grid-open], [data-live-open]");
      if (!el) return;
      e.preventDefault();
      e.stopPropagation(); // before a framework <Link> on the same element can navigate
      if (el.hasAttribute("data-live-open")) return onLive(new CustomEvent(OPEN_LIVE_EVENT));
      const detail: OpenGridDetail = {
        question: el.dataset.gridQuestion,
        project: el.dataset.gridProject,
      };
      window.dispatchEvent(new CustomEvent(OPEN_GRID_EVENT, { detail }));
    };

    window.addEventListener(OPEN_GRID_EVENT, onOpen);
    window.addEventListener(OPEN_LIVE_EVENT, onLive);
    window.addEventListener(ACT_EVENT, onAct);
    document.addEventListener("click", onClick, true);
    // First sign of intent: fetch the panel so it opens at once.
    const warm = () => void loadSheet();
    window.addEventListener("pointermove", warm, { once: true, passive: true });
    window.addEventListener("keydown", warm, { once: true });
    // A reply email links back to its thread: /?chat=<id>.<signature>. Keep the pair, tidy the address, open the chat.
    const thread = parseThreadParam(new URLSearchParams(window.location.search).get("chat"));
    if (thread) {
      saveSession({ ...thread, name: "" });
      const url = new URL(window.location.href);
      url.searchParams.delete("chat");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      onLive(new CustomEvent(OPEN_LIVE_EVENT));
    }
    document.documentElement.dataset.grid = "ready";
    return () => {
      delete document.documentElement.dataset.grid;
      window.removeEventListener(OPEN_GRID_EVENT, onOpen);
      window.removeEventListener(OPEN_LIVE_EVENT, onLive);
      window.removeEventListener(ACT_EVENT, onAct);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pointermove", warm);
      window.removeEventListener("keydown", warm);
    };
  }, [router]);

  return (
    <>
      <SelectionAsk />
      {mounted ? (
        <GridSheet
          open={open}
          onOpenChange={setOpen}
          view={view}
          onView={setView}
          prefill={prefill}
          onClosed={() => {
            const back = opener.current;
            opener.current = null;
            if (back?.isConnected) back.focus();
          }}
        />
      ) : null}
    </>
  );
}
