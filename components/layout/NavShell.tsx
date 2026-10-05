"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Sticky header that gains a 1px bottom border once the page scrolls. On the home page it also marks the nav link of
 * the chapter you are reading (`aria-current`, drawn as a row of squares under it in styles/system.css), and on the
 * other pages the link of the page you are on.
 */
export function NavShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      el.dataset.scrolled = window.scrollY > 4 ? "true" : "false";
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const links = [...el.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Primary"] a[href]')];
    const mark = (href: string | null) => {
      for (const a of links) {
        if (href && a.getAttribute("href") === href)
          a.setAttribute("aria-current", href.startsWith("/#") ? "location" : "page");
        else a.removeAttribute("aria-current");
      }
    };
    if (pathname !== "/") {
      const path = pathname;
      mark(links.find((a) => path.startsWith(a.getAttribute("href") ?? "\0"))?.getAttribute("href") ?? null);
      return;
    }
    const sections = links
      .map((a) => a.getAttribute("href") ?? "")
      .filter((h) => h.startsWith("/#"))
      .map((h) => document.getElementById(h.slice(2)))
      .filter((s): s is HTMLElement => s !== null);
    if (!sections.length || typeof IntersectionObserver === "undefined") return;
    const seen = new Map<Element, boolean>();
    // a chapter is "current" while it crosses a line a third of the way down the screen
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target, e.isIntersecting);
        const now = sections.find((s) => seen.get(s));
        mark(now ? `/#${now.id}` : null);
      },
      { rootMargin: "-33% 0px -66% 0px" },
    );
    for (const s of sections) io.observe(s);
    return () => {
      io.disconnect();
      mark(null);
    };
  }, [pathname]);

  return (
    <header
      ref={ref}
      data-scrolled="false"
      className="sticky top-0 z-50 h-(--nav-height) border-b border-transparent bg-bg transition-colors duration-200 data-[scrolled=true]:border-border"
    >
      {children}
    </header>
  );
}
