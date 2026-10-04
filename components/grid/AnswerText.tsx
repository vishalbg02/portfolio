import Link from "next/link";
import { parseBlocks, type Inline } from "@/lib/ai/sanitize";
import type { Source } from "@/lib/ai/protocol";

/**
 * Renders a model answer as plain React text (never as HTML). Citations [n] become links to the
 * source page; numbers with no matching source are dropped by the parser.
 */
export function AnswerText({
  text,
  sources,
  streaming = false,
}: {
  text: string;
  sources: Source[];
  /** Shows a caret after the last word while the answer is still arriving. */
  streaming?: boolean;
}) {
  const blocks = parseBlocks(text, sources.length);
  const caret = streaming ? <span aria-hidden="true" className="grid-caret" /> : null;
  const renderInline = (parts: Inline[]) =>
    parts.map((p, i) => {
      if (p.kind === "text") return <span key={i}>{p.text}</span>;
      if (p.kind === "bold")
        return (
          <strong key={i} className="font-semibold text-text">
            {p.text}
          </strong>
        );
      const src = sources[p.n - 1];
      return src ? (
        <sup key={i} className="mx-px">
          <Link
            href={src.url}
            aria-label={`Source ${p.n}: ${src.title}`}
            className="font-mono text-[11px] text-link underline-offset-2 hover:underline"
          >
            [{p.n}]
          </Link>
        </sup>
      ) : null;
    });

  return (
    <div className="space-y-2 text-[15px] leading-relaxed text-text">
      {blocks.map((b, i) =>
        b.kind === "p" ? (
          <p key={i}>
            {renderInline(b.inline)}
            {i === blocks.length - 1 ? caret : null}
          </p>
        ) : (
          <ul key={i} className="space-y-1.5">
            {b.items.map((item, j) => (
              <li key={j} className="flex gap-2.5">
                <span aria-hidden="true" className="text-accent">
                  ›
                </span>
                <span>
                  {renderInline(item)}
                  {i === blocks.length - 1 && j === b.items.length - 1 ? caret : null}
                </span>
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
