"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { GridFace } from "@/components/grid/GridFace";
import { useGridFace } from "@/components/grid/useGridFace";
import { track } from "@/lib/analytics";
import { openGrid } from "@/lib/grid/events";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils/cn";

type Id = "work" | "resume" | "grid" | "recruiter" | "contact";
type Section = "work" | "ask" | "contact";

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
const ICONS: Record<Exclude<Id, "grid">, ReactNode> = {
  work: icon(
    <>
      <rect x="3" y="3" width="5.5" height="5.5" rx="1" />
      <rect x="11.5" y="3" width="5.5" height="5.5" rx="1" />
      <rect x="3" y="11.5" width="5.5" height="5.5" rx="1" />
      <rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1" />
    </>,
  ),
  recruiter: icon(<path d="M10 3.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M4 16.5c.6-3 3-4.5 6-4.5s5.4 1.5 6 4.5" />),
  resume: icon(<path d="M5 2.5h7l3 3v12H5z M12 2.5v3h3 M7.5 9h5 M7.5 12h5" />),
  contact: icon(<path d="M2.5 5h15v10h-15z M2.5 5.5l7.5 5.5 7.5-5.5" />),
};

/**
 * Phone-only bottom dock (≤ 768 px): Work · Résumé · GRID · Recruiter · Contact, with GRID larger in the middle
 * (it opens the full-screen chat). Hides on scroll-down and returns on scroll-up (transform only); the page
 * reserves its height at the bottom so it never covers content.
 */
export function MobileDock() {
  const face = useGridFace();
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const [section, setSection] = useState<Section | null>(null);
  const last = useRef(0);
  const height = useRef(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - last.current;
        // The page got taller or shorter (a lazy section swapped in): scroll anchoring may have nudged the
        // position, and that is not the visitor scrolling. Take the new position as the baseline instead.
        const h = document.documentElement.scrollHeight;
        if (height.current && h !== height.current) {
          height.current = h;
          last.current = y;
          return;
        }
        height.current = h;
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
    const ids: Section[] = ["work", "ask", "contact"];
    const seen = new Map<Section, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id as Section, e.isIntersecting);
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
    : pathname.startsWith("/recruiter")
      ? "recruiter"
      : pathname.startsWith("/work")
        ? "work"
        : pathname === "/"
          ? section === "ask"
            ? "grid"
            : section
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
          prefetch={false}
          onClick={() => tap("work")}
          className={cn(item, tone("work"))}
          aria-current={active === "work" ? "true" : undefined}
        >
          {dot("work")}
          {ICONS.work}
          Work
        </Link>
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
        <div className="relative flex min-w-0 flex-1 justify-center">
          <button
            type="button"
            onClick={() => {
              tap("grid");
              openGrid();
            }}
            aria-haspopup="dialog"
            aria-label="Ask GRID"
            className={cn(
              "absolute -top-4 flex size-[3.75rem] flex-col items-center justify-center gap-1 rounded-card border-2 bg-surface font-mono text-[10px] tracking-[0.1em] transition-colors",
              active === "grid"
                ? "border-accent text-accent"
                : "border-border-2 text-text hover:border-accent",
            )}
          >
            <GridFace state={face} size={24} />
            GRID
          </button>
        </div>
        <Link
          href="/recruiter"
          onClick={() => tap("recruiter")}
          className={cn(item, tone("recruiter"))}
          aria-current={active === "recruiter" ? "page" : undefined}
        >
          {dot("recruiter")}
          {ICONS.recruiter}
          Recruiter
        </Link>
        <Link
          href="/#contact"
          prefetch={false}
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
