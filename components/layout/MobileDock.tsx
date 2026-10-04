"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { openChat } from "@/components/chat/ChatLauncher";
import { track } from "@/lib/analytics";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils/cn";

type Id = "work" | "ask" | "resume" | "contact";

const icon = (path: ReactNode) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden="true"
  >
    {path}
  </svg>
);
const ICONS: Record<Id, ReactNode> = {
  work: icon(
    <>
      <rect x="3" y="3" width="5.5" height="5.5" rx="1" />
      <rect x="11.5" y="3" width="5.5" height="5.5" rx="1" />
      <rect x="3" y="11.5" width="5.5" height="5.5" rx="1" />
      <rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1" />
    </>,
  ),
  ask: icon(<path d="M3.5 4.5h13v8h-6.5L6 16v-3.5H3.5z M8 7.8c0-1.4 4-1.4 4 0 0 1.2-2 1.1-2 2.3" />),
  resume: icon(<path d="M5 2.5h7l3 3v12H5z M12 2.5v3h3 M7.5 9h5 M7.5 12h5" />),
  contact: icon(<path d="M2.5 5h15v10h-15z M2.5 5.5l7.5 5.5 7.5-5.5" />),
};

/**
 * Phone-only bottom dock (≤ 768 px): Work · Ask · Résumé · Contact. Hides on scroll-down and returns
 * on scroll-up (transform only); the page reserves its height at the bottom so it never covers content.
 */
export function MobileDock() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const [section, setSection] = useState<Id | null>(null);
  const last = useRef(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - last.current;
        if (y < 80 || dy < -6) setHidden(false);
        else if (dy > 6) setHidden(true);
        last.current = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // On the home page the dock follows the section being read.
  useEffect(() => {
    if (pathname !== "/") return;
    const ids: Id[] = ["work", "ask", "contact"];
    const seen = new Map<Id, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id as Id, e.isIntersecting);
        const current = [...ids].reverse().find((id) => seen.get(id));
        setSection(current ?? null);
      },
      { rootMargin: "-35% 0px -45% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [pathname]);

  const active: Id | null = pathname.startsWith("/resume")
    ? "resume"
    : pathname.startsWith("/work")
      ? "work"
      : pathname === "/"
        ? section
        : null;

  const item =
    "relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 font-mono text-[11px] transition-colors";
  const tone = (id: Id) => (active === id ? "text-accent" : "text-muted hover:text-text");
  const dot = (id: Id) =>
    active === id ? (
      <span aria-hidden="true" className="absolute top-1.5 size-1 rounded-pill bg-accent" />
    ) : null;
  const tap = (id: Id) => {
    haptic();
    track("dock_tap", { item: id });
  };

  return (
    <nav
      aria-label="Quick links"
      data-hidden={hidden}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] transition-transform duration-200 data-[hidden=true]:translate-y-full md:hidden"
    >
      <div className="flex h-16">
        <Link
          href="/#work"
          onClick={() => tap("work")}
          className={cn(item, tone("work"))}
          aria-current={active === "work" ? "true" : undefined}
        >
          {dot("work")}
          {ICONS.work}
          Work
        </Link>
        <button
          type="button"
          onClick={() => {
            tap("ask");
            openChat();
          }}
          className={cn(item, tone("ask"))}
          aria-haspopup="dialog"
        >
          {dot("ask")}
          {ICONS.ask}
          Ask
        </button>
        <Link
          href="/resume"
          onClick={() => tap("resume")}
          className={cn(item, tone("resume"))}
          aria-current={active === "resume" ? "page" : undefined}
        >
          {dot("resume")}
          {ICONS.resume}
          Résumé
        </Link>
        <Link
          href="/#contact"
          onClick={() => tap("contact")}
          className={cn(item, tone("contact"))}
          aria-current={active === "contact" ? "true" : undefined}
        >
          {dot("contact")}
          {ICONS.contact}
          Contact
        </Link>
      </div>
    </nav>
  );
}
