import { Chip } from "@/components/ui/Chip";
import { identityBg } from "@/components/work/identity";
import { ProjectLinks } from "@/components/work/ProjectLinks";
import { StaticBadge, StatusBadge } from "@/components/work/StatusBadge";
import { profile } from "@/content/profile";
import { FocusOnClick } from "./FocusOnClick";
import { HeroPrompt } from "./HeroPrompt";
import { StatusCheck } from "./StatusCheck";

/**
 * Hero visual: a terminal. `ship --all` is typed (CSS), then the four products appear one after another,
 * each ✓ landing when its real status ping resolves. Rows are native <details> (exclusive group): they expand
 * in place with the summary, stack and links, with or without JavaScript. The prompt at the bottom is real.
 * Everything above the prompt is server-rendered, so the final list is there even with JS off.
 */
export function ShipConsole() {
  return (
    <div className="brackets w-full max-w-[520px] rounded-card border border-border bg-bg font-mono text-sm px-shadow lg:ml-auto">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="size-2.5 rounded-pill border border-border-2" />
          <span className="size-2.5 rounded-pill border border-border-2" />
          <span className="size-2.5 rounded-pill border border-border-2" />
        </span>
        <span className="text-xs text-muted">~/vishalbg — ship</span>
      </div>

      <FocusOnClick targetId="hero-term-input">
        <div className="px-4 py-4">
          <p className="text-text">
            <span aria-hidden="true" className="text-accent">
              $
            </span>{" "}
            <span className="term-type">ship --all</span>
          </p>

          <ul className="mt-3 divide-y divide-border">
            {profile.projects.map((p, i) => (
              <li key={p.slug} className="term-row" style={{ ["--i" as string]: i }}>
                <details name="ship-rows">
                  <summary
                    data-track="hero_row_expand"
                    data-track-project={p.slug}
                    className="-mx-2 flex cursor-pointer list-none items-start gap-3 rounded-sm px-2 py-2.5 transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <StatusCheck slug={p.slug} pinged={Boolean(p.live)} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3 lg:flex-col xl:flex-row">
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-text">
                          <span
                            aria-hidden="true"
                            className={`size-2 shrink-0 rounded-pill ${identityBg[p.slug]}`}
                          />
                          <span className="truncate">{p.name}</span>
                        </span>
                        <span className="mt-0.5 block truncate pl-4 text-xs text-muted">{p.tagline}</span>
                      </span>
                      <span className="shrink-0 pl-4 sm:pt-px sm:pl-0 lg:pl-4 xl:pl-0">
                        {p.live ? (
                          <StatusBadge slug={p.slug} bare />
                        ) : p.badge ? (
                          <StaticBadge label={p.badge} className="border-0 px-0" />
                        ) : null}
                      </span>
                    </span>
                    <span aria-hidden="true" className="term-chev mt-0.5 shrink-0 text-muted">
                      ▸
                    </span>
                  </summary>
                  <div className="space-y-3 pb-3 pl-6 text-xs">
                    <p className="line-clamp-2 text-muted">{p.summary}</p>
                    <ul className="flex flex-wrap gap-1.5" aria-label={`${p.name} stack`}>
                      {p.stack.slice(0, 4).map((s) => (
                        <li key={s}>
                          <Chip>{s}</Chip>
                        </li>
                      ))}
                    </ul>
                    <ProjectLinks project={p} className="flex flex-wrap items-center gap-x-4 gap-y-1.5" />
                  </div>
                </details>
              </li>
            ))}
          </ul>

          <HeroPrompt />
        </div>
      </FocusOnClick>

      <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-2.5 text-xs text-muted">
        <span className="truncate">{profile.motto}</span>
        <span aria-hidden="true" className="hidden shrink-0 items-center gap-1 sm:flex">
          <span className="mr-1">less</span>
          {["bg-grid-0", "bg-grid-1", "bg-grid-2", "bg-grid-3", "bg-grid-4"].map((c) => (
            <span
              key={c}
              className={`size-2.5 rounded-[2px] ${c} ${c === "bg-grid-0" ? "border border-border" : ""}`}
            />
          ))}
          <span className="ml-1">more</span>
        </span>
      </div>
    </div>
  );
}
