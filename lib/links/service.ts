import "server-only";
import { claimOnce } from "@/lib/notify/once";
import { escapeHtml } from "@/lib/notify/telegram";
import { istClock } from "@/lib/live/presence";
import { defaultDeps, type Deps } from "@/lib/live/service";
import { LINK, type CompanyLink } from "@/lib/live/types";
import { parseLinkArgs } from "./label";
import { linkUrl, newLinkId, parseLinkToken } from "./token";

/** What a visitor's browser may be told about a link: only the labels Vishal typed. */
export type LinkInfo = { id: string; company: string; role: string | null };

export type LinkEvent = "resume" | "chat";
const EVENT_TEXT: Record<LinkEvent, string> = {
  resume: "downloaded the résumé",
  chat: "started a chat with GRID",
};

const who = (l: Pick<CompanyLink, "company" | "role">) =>
  `<b>${escapeHtml(l.company)}</b>${l.role ? ` · ${escapeHtml(l.role)}` : ""}`;

/** `/link Infosys SDE`: makes the link, says where it goes. Returns the text to send back. */
export async function createCompanyLink(
  arg: string,
  deps: Deps = defaultDeps(),
): Promise<{ ok: true; link: CompanyLink; url: string } | { ok: false }> {
  const parsed = parseLinkArgs(arg);
  if (!parsed) return { ok: false };
  const link: CompanyLink = {
    id: newLinkId(),
    company: parsed.company,
    role: parsed.role,
    createdAt: deps.now(),
  };
  await deps.store.createLink(link);
  return { ok: true, link, url: linkUrl(link.id) };
}

/** What the page may show for a token, or null (a bad signature, an expired or unknown link). Nothing else is read. */
export async function lookupLink(token: unknown, deps: Deps = defaultDeps()): Promise<LinkInfo | null> {
  const id = parseLinkToken(token);
  if (!id) return null;
  const l = await deps.store.getLink(id);
  return l ? { id: l.id, company: l.company, role: l.role } : null;
}

/**
 * A visitor opened the link. The first open in six hours pings Vishal ("Infosys link opened · 11:42 am IST"), and every
 * open is counted for /links. No personal data is involved: only the link's id and the time.
 */
export async function recordOpen(token: unknown, deps: Deps = defaultDeps()): Promise<LinkInfo | null> {
  const info = await lookupLink(token, deps);
  if (!info) return null;
  await deps.store.noteLinkOpen(info.id);
  if (await claimOnce(`linkopen:${info.id}`, LINK.openPingSec)) {
    await deps.sendTelegram(`🔗 ${who(info)} link opened · ${istClock(deps.now())} IST`);
  }
  return info;
}

/** A résumé download or a chat start from a link, at most one ping per kind per hour. */
export async function recordEvent(
  token: unknown,
  kind: LinkEvent,
  deps: Deps = defaultDeps(),
): Promise<boolean> {
  const info = await lookupLink(token, deps);
  if (!info) return false;
  if (await claimOnce(`linkevent:${info.id}:${kind}`, LINK.eventPingSec)) {
    await deps.sendTelegram(
      `${kind === "resume" ? "📄" : "💬"} ${who(info)} ${EVENT_TEXT[kind]} · ${istClock(deps.now())} IST`,
    );
  }
  return true;
}

/** `/links`: the newest ten, with how often each was opened. */
export async function linksText(deps: Deps = defaultDeps()): Promise<string> {
  const rows = await deps.store.listLinks(10);
  if (rows.length === 0) return "No links yet. /link Infosys SDE makes one.";
  return [
    "<b>Your links</b>",
    ...rows.map(
      (l) =>
        `${who(l)}: ${l.opens} open${l.opens === 1 ? "" : "s"} · <code>${escapeHtml(linkUrl(l.id))}</code>`,
    ),
  ].join("\n");
}
