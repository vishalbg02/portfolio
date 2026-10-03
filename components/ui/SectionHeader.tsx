import { cn } from "@/lib/utils/cn";
import { Decode } from "./Decode";

/**
 * Mono uppercase label with a green prefix and a 1px rule — echoes the GitHub profile.
 * e.g. <SectionHeader prefix="{ }" label="Work" />
 */
export function SectionHeader({
  prefix,
  label,
  id,
  title,
  className,
}: {
  prefix: string;
  label: string;
  id?: string;
  title?: string;
  className?: string;
}) {
  return (
    <header className={cn("mb-8 md:mb-10", className)}>
      <div className="flex items-center gap-3 font-mono text-xs tracking-[0.12em] uppercase">
        <span aria-hidden="true" className="text-accent">
          {prefix}
        </span>
        <span id={id} className="text-muted">
          <Decode text={label} />
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      {title ? (
        <h2 className="mt-4 text-2xl font-semibold text-text md:text-3xl">
          <Decode text={title} />
        </h2>
      ) : null}
    </header>
  );
}
