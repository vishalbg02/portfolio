import type { ComponentProps } from "react";
import { ArchitectureDiagram } from "@/components/diagram/ArchitectureDiagram";
import { graphs } from "@/components/diagram/graphs";
import type { ProjectSlug } from "@/lib/content/profile-schema";
import { slugify } from "@/lib/utils/slugify";
import { Decision, Decisions } from "./Decisions";
import { Snippet } from "./Snippet";

const prose = "max-w-[68ch]";

/** MDX element map for a case study. `slug` binds <Architecture /> to the right graph. */
export function getMdxComponents(slug: ProjectSlug) {
  return {
    // id = slug of the heading, so citations can deep-link ("/work/talnio#key-decisions").
    h2: ({ children, ...p }: ComponentProps<"h2">) => (
      <h2
        id={slugify(String(children))}
        className="mt-14 mb-4 border-t border-border pt-8 text-2xl font-semibold text-text first:mt-0 first:border-0 first:pt-0"
        {...p}
      >
        {children}
      </h2>
    ),
    h3: (p: ComponentProps<"h3">) => <h3 className="mt-8 mb-2 text-lg font-semibold text-text" {...p} />,
    p: (p: ComponentProps<"p">) => (
      <p className={`${prose} my-4 text-[17px] leading-[1.7] text-muted`} {...p} />
    ),
    ul: (p: ComponentProps<"ul">) => (
      <ul
        className={`${prose} my-4 space-y-2.5 pl-5 text-[17px] leading-[1.7] text-muted marker:text-accent [&>li]:list-['›_'] [&>li]:pl-2`}
        {...p}
      />
    ),
    li: (p: ComponentProps<"li">) => <li {...p} />,
    strong: (p: ComponentProps<"strong">) => <strong className="font-semibold text-text" {...p} />,
    a: (p: ComponentProps<"a">) => <a className="text-link underline underline-offset-4" {...p} />,
    code: (p: ComponentProps<"code">) => (
      <code
        className="rounded-[4px] border border-border bg-surface px-1.5 py-0.5 font-mono text-[0.9em] text-text"
        {...p}
      />
    ),
    Decisions,
    Decision,
    Snippet,
    Architecture: () => <ArchitectureDiagram graph={graphs[slug]} />,
  };
}
