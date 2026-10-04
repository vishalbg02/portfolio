import { displayScore, readLighthouse } from "@/lib/lighthouse";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

/**
 * "This site" in the footer: the real Lighthouse scores from the latest CI run against production
 * (generated/lighthouse.json). Shown truncated, never rounded up. No file, no strip.
 */
export function LighthouseStrip() {
  const lh = readLighthouse();
  if (!lh) return null;
  const items = [
    ["Performance", lh.scores.performance],
    ["Accessibility", lh.scores.accessibility],
    ["Best Practices", lh.scores.bestPractices],
    ["SEO", lh.scores.seo],
  ] as const;
  return (
    <div
      data-testid="lighthouse-strip"
      className="flex flex-col gap-3 border-t border-border pt-6 font-mono text-xs sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6"
    >
      <p className="text-text">
        <span className="text-accent">$</span> lighthouse --mobile{" "}
        <span className="text-muted">· this site</span>
      </p>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
        {items.map(([label, n]) => (
          <li key={label}>
            {label} <span className="text-text tabular-nums">{displayScore(n)}</span>
          </li>
        ))}
      </ul>
      <p>
        Measured {day(lh.generatedAt)} on {lh.runs} runs, commit {lh.commit}
        {lh.runUrl ? (
          <>
            {" "}
            ·{" "}
            <a href={lh.runUrl} className="hover:text-text" target="_blank" rel="noopener noreferrer">
              CI run ↗
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}
