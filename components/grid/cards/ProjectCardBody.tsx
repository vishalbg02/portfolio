import Link from "next/link";
import type { ReactNode } from "react";
import { Chip } from "@/components/ui/Chip";
import { identityBg } from "@/components/work/identity";
import type { UiPart } from "@/lib/ai/protocol";
import { cn } from "@/lib/utils/cn";

type Project = Extract<UiPart, { kind: "project" }>;

const action =
  "inline-flex min-h-8 items-center gap-1 rounded-sm font-mono text-xs text-link underline-offset-4 hover:underline pointer-coarse:min-h-11";

/**
 * A project as a compact card: real capture, name, line, stack, links. Pure markup (no hooks, no handlers),
 * so the same card renders in the chat and, on the server, in the Ask section's example. `actions` is a slot
 * for the chat's "show the diagram / play the walkthrough" buttons.
 */
export function ProjectCardBody({ part, actions }: { part: Project; actions?: ReactNode }) {
  const img = part.image;
  return (
    <article
      data-grid-card="project"
      data-grid-project={part.slug}
      className="overflow-hidden rounded-card border border-border bg-bg"
    >
      {img ? (
        <div
          className={cn(
            "stage-grid relative flex h-[150px] items-center justify-center overflow-hidden border-b border-border",
            img.frame === "phone" ? "py-3" : "",
          )}
        >
          <picture className={img.frame === "phone" ? "block h-full" : "block size-full"}>
            <source type="image/avif" srcSet={img.avifSet} />
            <source type="image/webp" srcSet={img.webpSet} />
            {/* the pre-encoded capture, same files as the Work stage */}
            <img
              src={img.src}
              alt={img.alt}
              width={img.width}
              height={img.height}
              loading="lazy"
              decoding="async"
              className={
                img.frame === "phone"
                  ? "rounded-md block h-full w-auto border border-border-2"
                  : "block size-full object-cover object-top"
              }
            />
          </picture>
        </div>
      ) : null}
      <div className="p-3.5">
        <p className="flex items-start gap-2 font-mono text-[11px] text-muted">
          <span
            aria-hidden="true"
            className={cn(
              "mt-1 size-2 shrink-0 rounded-pill",
              identityBg[part.slug as keyof typeof identityBg],
            )}
          />
          <span>{part.eyebrow}</span>
        </p>
        <h4 className="mt-1.5 text-lg font-semibold text-text">{part.name}</h4>
        <p className="mt-0.5 text-sm text-muted">{part.tagline}</p>
        <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Stack">
          {part.stack.slice(0, 5).map((s) => (
            <li key={s}>
              <Chip>{s}</Chip>
            </li>
          ))}
          {part.stack.length > 5 ? (
            <li>
              <Chip>+{part.stack.length - 5}</Chip>
            </li>
          ) : null}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          {part.links.map((l) =>
            l.external ? (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={action}>
                {l.label} <span aria-hidden="true">↗</span>
                <span className="sr-only"> ({part.name}, opens in a new tab)</span>
              </a>
            ) : (
              <Link key={l.label} href={l.href} className={action}>
                {l.label} <span aria-hidden="true">→</span>
              </Link>
            ),
          )}
        </div>
        {actions ? (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">{actions}</div>
        ) : null}
      </div>
    </article>
  );
}
