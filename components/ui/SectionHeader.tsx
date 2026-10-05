import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { Decode } from "./Decode";
import { PixelText } from "./PixelText";
import { Reveal } from "./Reveal";

/**
 * Mono uppercase label with a green prefix and a 1px rule — echoes the GitHub profile.
 * e.g. <SectionHeader prefix="{ }" label="Work" />
 *
 * With `chapter` it is a home chapter opener (docs/DESIGN-V4.md §8): the chapter's number in pixel squares that fill
 * as it scrolls in, the mono label, and the H2 at the display size. Every home chapter opens the same way.
 */
export function SectionHeader({
  prefix,
  label,
  id,
  title,
  ask,
  chapter,
  className,
}: {
  prefix: string;
  label: string;
  id?: string;
  title?: string;
  /** A question about this section: adds an "Ask about this" link that opens GRID with it. */
  ask?: string;
  /** The home chapter number (1–6): draws the opener's pixel numeral and the display-size H2. */
  chapter?: number;
  className?: string;
}) {
  return (
    <header className={cn("mb-8 md:mb-10", className)}>
      <div className="flex items-center gap-3 font-mono text-xs tracking-[0.12em] uppercase">
        {chapter ? (
          <Reveal threshold={0.6} className="shrink-0">
            <PixelText
              text={String(chapter).padStart(2, "0")}
              cell={4}
              gap={1}
              base={false}
              outline
              className="chapter-num"
            />
          </Reveal>
        ) : (
          <span aria-hidden="true" className="text-accent">
            {prefix}
          </span>
        )}
        <span id={id} className="text-muted">
          <Decode text={label} />
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        {ask ? (
          <Link
            href="/#ask"
            prefetch={false}
            data-grid-open=""
            data-grid-question={ask}
            data-cursor="ask"
            aria-label={`Ask about this: ${label}`}
            className="needs-grid inline-flex items-center gap-1.5 rounded-sm text-[11px] tracking-normal text-muted normal-case transition-colors hover:text-accent pointer-coarse:min-h-11"
          >
            <span aria-hidden="true" className="text-accent">
              ?
            </span>
            Ask about this
          </Link>
        ) : null}
      </div>
      {title ? (
        <h2
          className={cn(
            "font-semibold text-text",
            chapter
              ? "mt-5 text-[2rem] leading-[1.08] tracking-[-0.035em] text-balance md:text-[3.5rem]"
              : "mt-4 text-2xl md:text-3xl",
          )}
        >
          <Decode text={title} />
        </h2>
      ) : null}
    </header>
  );
}
