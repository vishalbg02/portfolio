"use client";

import { usePathname, useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import type { Source } from "@/lib/ai/protocol";
import { citedNumbers } from "@/lib/ai/sanitize";
import { flashProof, jumpTarget } from "@/lib/proof";

/** "Jump to proof": the sources an answer cites, each taking you to (and flashing) the thing it cites. */
export function SourcesRow({
  text,
  sources,
  onJump,
}: {
  text: string;
  sources: Source[];
  onJump?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  if (sources.length === 0) return null;
  const cited = citedNumbers(text, sources.length);
  const shown = (cited.length > 0 ? cited : sources.slice(0, 2).map((s) => s.n)).map((n) => sources[n - 1]!);

  const jump = (url: string) => {
    const target = jumpTarget(url, pathname);
    track("proof_jump", { kind: target.type === "scroll" ? "same_page" : "other_page" });
    onJump?.(); // close a modal sheet first so the page underneath is what scrolls
    if (target.type === "scroll") window.setTimeout(() => flashProof(target.id), onJump ? 120 : 0);
    else router.push(target.href);
  };

  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 font-mono text-[11px] text-muted">
      <span>Sources</span>
      {shown.map((s) => (
        <button
          key={s.n}
          type="button"
          onClick={() => jump(s.url)}
          className="min-h-8 rounded-pill border border-border px-2.5 py-1 text-link transition-colors hover:border-border-2 pointer-coarse:min-h-11"
        >
          <span className="sr-only">Jump to </span>[{s.n}]{" "}
          {s.title.length > 42 ? `${s.title.slice(0, 40)}…` : s.title}
        </button>
      ))}
    </p>
  );
}
