"use client";

import { openChat } from "@/lib/grid/events";
import { track } from "@/lib/analytics";

/** "Ask about this project": opens GRID with a first question, retrieval scoped to this project. */
export function AskProject({ slug, name }: { slug: string; name: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        track("project_ask", { project: slug });
        openChat(`What should I know about the ${name} project?`, slug);
      }}
      className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-border-2 px-4 font-mono text-sm text-text transition-colors hover:border-accent hover:text-accent"
    >
      <span aria-hidden="true" className="text-accent">
        ?
      </span>
      Ask about {name}
    </button>
  );
}
