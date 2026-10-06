import { snippets } from "@/content/work/snippets";
import { highlight } from "@/lib/content/highlight";

/** Syntax-highlighted snippet (shiki, github-dark): a real excerpt with its source, or labelled illustrative. Server component. */
export async function Snippet({ id }: { id: string }) {
  const snippet = snippets[id];
  if (!snippet) throw new Error(`Unknown snippet "${id}"`);
  const html = await highlight(snippet.code, snippet.lang);

  return (
    <figure className="my-6 overflow-hidden rounded-card border border-border bg-surface">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <span className="font-mono text-xs text-text">{snippet.title}</span>
        {snippet.source ? (
          <a
            href={snippet.source.href}
            target="_blank"
            rel="noopener noreferrer"
            className="tap-slop rounded-pill border border-accent px-2 py-0.5 font-mono text-[11px] text-accent"
          >
            from the project: {snippet.source.label} <span aria-hidden="true">↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <span className="rounded-pill border border-border px-2 py-0.5 font-mono text-[11px] text-muted">
            illustrative snippet
          </span>
        )}
      </figcaption>
      <div className="code-block text-[13px]" dangerouslySetInnerHTML={{ __html: html }} />
      <p className="border-t border-border px-4 py-2.5 text-xs text-muted">{snippet.caption}</p>
    </figure>
  );
}
