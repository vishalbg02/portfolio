"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GridFace } from "@/components/grid/GridFace";
import { identityBg } from "@/components/work/identity";
import { track } from "@/lib/analytics";
import { openGrid } from "@/lib/grid/events";
import { rankForRole } from "@/lib/links/role";
import { LINK_INFO_KEY } from "@/lib/links/session";
import { cn } from "@/lib/utils/cn";

type Info = { id: string; company: string; role: string | null };

const small =
  "inline-flex min-h-8 items-center gap-1 rounded-sm border border-border px-2.5 font-mono text-xs text-text transition-colors hover:border-border-2 pointer-coarse:min-h-11";

/**
 * "Hi Infosys team 👋": a slim banner under the nav for someone who arrived through a personal link, with what is most
 * relevant for the role it was made for. The company and role are only what Vishal typed, looked up by the signed code on
 * the server: nothing from the address is ever shown. It sits over the page (fixed), so nothing moves when it appears.
 * The matching projects get an outline on the page while it is open; dismissing it takes the outline away.
 */
export default function CompanyBanner({ token, onGone }: { token: string; onGone: () => void }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cached = sessionStorage.getItem(LINK_INFO_KEY);
        if (cached) {
          const c = JSON.parse(cached) as Info & { t: string };
          if (c.t === token) return alive && setInfo(c);
        }
      } catch {
        /* no cache */
      }
      try {
        const res = await fetch(`/api/link?c=${encodeURIComponent(token)}`);
        if (!res.ok) return alive && onGone();
        const j = (await res.json()) as { ok: boolean } & Info;
        if (!alive || !j.ok) return;
        const next = { id: j.id, company: j.company, role: j.role };
        setInfo(next);
        track("company_link_open", { code: j.id });
        try {
          sessionStorage.setItem(LINK_INFO_KEY, JSON.stringify({ ...next, t: token }));
        } catch {
          /* ignore */
        }
      } catch {
        /* offline: no banner */
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, onGone]);

  const rank = useMemo(() => rankForRole(info?.role ?? null), [info]);

  // outline the matching project cards while the banner is up
  useEffect(() => {
    if (!info || dismissed) return;
    const els = rank.projects.flatMap((p) => [
      ...document.querySelectorAll<HTMLElement>(`[data-project="${p.slug}"]`),
    ]);
    els.forEach((el) => el.setAttribute("data-role-hit", ""));
    return () => els.forEach((el) => el.removeAttribute("data-role-hit"));
  }, [info, dismissed, rank]);

  if (!info || dismissed) return null;
  const roleText = info.role ?? rank.label;

  return (
    <aside
      role="region"
      aria-label={`A personal link for ${info.company}`}
      data-testid="company-banner"
      className="fixed inset-x-0 top-[var(--nav-height)] z-40 border-b border-border bg-surface"
    >
      <div className="container-page flex items-center gap-3 py-2">
        <GridFace state="idle" size={20} still className="max-sm:hidden" />
        <p className="min-w-0 flex-1 truncate text-sm text-text" data-testid="company-greeting">
          Hi {info.company} team <span aria-hidden="true">👋</span>
          {info.role ? <span className="text-muted"> · {info.role}</span> : null}
        </p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="company-panel"
          onClick={() => setOpen((o) => !o)}
          className={small}
        >
          What&apos;s relevant<span className="max-sm:hidden">for {roleText}</span>
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          className={cn(small, "px-2.5")}
        >
          ✕
        </button>
      </div>
      {open ? (
        <div id="company-panel" className="border-t border-border">
          <div className="container-page grid gap-4 py-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div>
              <h2 className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">
                Most relevant for {roleText}
              </h2>
              <ul className="mt-2 space-y-2">
                {rank.projects.map((p) => (
                  <li key={p.slug} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link
                      href={`/work/${p.slug}`}
                      className="inline-flex items-center gap-2 text-sm text-link underline-offset-4 hover:underline"
                    >
                      <span aria-hidden="true" className={cn("size-2.5 rounded-[2px]", identityBg[p.slug])} />
                      {p.name}
                    </Link>
                    <span className="font-mono text-[11px] text-muted">
                      {p.skills.slice(0, 4).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 font-mono text-[11px] text-muted">
                Skills: {rank.skills.slice(0, 8).join(", ")}
              </p>
            </div>
            <div className="flex flex-wrap content-start gap-2">
              <button
                type="button"
                className={small}
                onClick={() => openGrid({ question: `Is he a fit for a ${roleText} role?` })}
              >
                Ask GRID about fit
              </button>
              <button
                type="button"
                className={small}
                onClick={() => openGrid({ question: `Tailor his résumé for a ${roleText} role` })}
              >
                Tailored résumé
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
