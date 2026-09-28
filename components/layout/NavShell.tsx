"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Sticky header that gains a 1px bottom border once the page scrolls. */
export function NavShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

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
