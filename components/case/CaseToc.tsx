"use client";

import { useEffect, useState } from "react";
import type { Heading } from "@/lib/content/headings";
import { cn } from "@/lib/utils/cn";

/** Table of contents with the section you're reading highlighted (the last heading above a line near the top). */
export function CaseToc({ headings }: { headings: Heading[] }) {
  const [active, setActive] = useState(headings[0]?.id ?? "");

  useEffect(() => {
    const els = headings
      .map((h) => document.getElementById(h.id))
      .filter((e): e is HTMLElement => Boolean(e));
    if (els.length === 0) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.3;
      let current = els[0]!.id;
      for (const el of els) if (el.getBoundingClientRect().top <= line) current = el.id;
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    // lazy parts of the page (captures, the diagram, a demo) settle after a jump and move the headings without a scroll
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onScroll);
    ro?.observe(document.getElementById("case-article") ?? document.body);
    return () => {
      ro?.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [headings]);

  return (
    <nav aria-label="On this page">
      <p className="mb-3 font-mono text-[11px] tracking-[0.12em] text-muted uppercase">On this page</p>
      <ol className="space-y-0.5 border-l border-border">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              aria-current={active === h.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l-2 py-1.5 pl-3 text-sm transition-colors",
                active === h.id
                  ? "border-accent text-text"
                  : "border-transparent text-muted hover:border-border-2 hover:text-text",
              )}
            >
              {h.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
