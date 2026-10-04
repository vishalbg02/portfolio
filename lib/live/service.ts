import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { canAutoReply } from "@/lib/email/templates";
import { sendReplyEmail } from "@/lib/email/send";
import { escapeHtml, sendTelegramMessage } from "@/lib/notify/telegram";
import { site } from "@/lib/site";
import { applyCommand, istClock, istDate, touch, effectivePresence, type Command } from "./presence";
import { currentPresence } from "./read";
import { getLiveStore, type LiveStore } from "./store";

export { currentPresence };
import { LIVE, type Conv, type LiveMessage } from "./types";

/**
 * The live chat's rules, with everything it touches passed in (`Deps`) so the tests can run it without Redis, Telegram
 * or email. Routes call these; they hold no HTTP detail.
 */
export type Deps = {
  store: LiveStore;
  now: () => number;
  sendTelegram: (text: string, opts?: { replyTo?: number }) => Promise<{ ok: boolean; messageId?: number }>;
  emailReply: (conv: Conv, text: string) => Promise<void>;
  /** Whether a reply can be emailed at all (a sender on a verified domain is needed). */
  canEmail: () => boolean;
};

export const defaultDeps = (): Deps => ({
  store: getLiveStore(),
  now: Date.now,
  sendTelegram: (text, opts) => sendTelegramMessage(text, opts),
  emailReply: sendReplyEmail,
  canEmail: () =>
    Boolean(env.RESEND_API_KEY && env.CONTACT_TO_EMAIL) && canAutoReply(process.env.CONTACT_FROM_EMAIL),
});

export const STAT = {
  conv: "conv_started",
  in: "msg_in",
  out: "msg_out",
  grid: "grid_msg",
  emailed: "emailed",
} as const;

const host = () => site.url.replace(/^https?:\/\//, "");

/* ── what lands in Telegram ──────────────────────────────────────────────────────────────────────── */

/** The visitor's first message carries the context; later ones are short. Everything typed is escaped. */
export function visitorPing(conv: Conv, text: string, first: boolean, now: number): string {
  const who = `${escapeHtml(conv.name)}${conv.org ? ` (${escapeHtml(conv.org)})` : ""}`;
  const head = `💬 <b>${who}</b> · <code>#${conv.short}</code>`;
  if (!first) return `${head}\n${escapeHtml(text)}`;
  return [
    head,
    `<i>${escapeHtml(host())}${escapeHtml(conv.page)}</i> · ${istClock(now)} IST`,
    conv.email ? `✉ ${escapeHtml(conv.email)}` : "✉ no email yet",
    conv.via === "grid" ? "sent from GRID's message card" : "live chat",
    "",
    escapeHtml(text),
    "",
    "↩ Reply to this message to answer.",
  ].join("\n");
}

/* ── conversations ───────────────────────────────────────────────────────────────────────────────── */

export type StartInput = {
  name: string;
  email: string | null;
  org: string | null;
  message: string;
  page: string;
  ipHash: string;
  via: Conv["via"];
};

/**
 * Starts a conversation. Telegram is asked FIRST: if Vishal can't be reached the visitor is told, and nothing is
 * stored. Only then is the thread created.
 */
export async function startConversation(
  input: StartInput,
  deps: Deps = defaultDeps(),
): Promise<{ ok: true; conv: Conv; message: LiveMessage } | { ok: false; error: "send_failed" }> {
  const now = deps.now();
  const conv: Conv = {
    id: randomUUID(),
    short: randomBytes(3).toString("hex"),
    name: input.name,
    email: input.email,
    org: input.org,
    page: input.page,
    ipHash: input.ipHash,
    createdAt: now,
    blocked: false,
    optOut: false,
    lastVisitorAt: now,
    lastOwnerAt: null,
    via: input.via,
  };
  const sent = await deps.sendTelegram(visitorPing(conv, input.message, true, now));
  if (!sent.ok) return { ok: false, error: "send_failed" };
  const { store } = deps;
  await store.createConv(conv);
  const message = await store.append(conv.id, { from: "visitor", text: input.message, t: now });
  if (sent.messageId) await store.mapTelegram(sent.messageId, conv.id);
  await Promise.all([
    store.addPending(conv.id, now),
    store.incrStat(istDate(now), input.via === "grid" ? STAT.grid : STAT.conv),
    store.incrStat(istDate(now), STAT.in),
  ]);
  return { ok: true, conv, message };
}

/** A later message from the visitor. */
export async function postVisitorMessage(
  conv: Conv,
  text: string,
  deps: Deps = defaultDeps(),
): Promise<{ ok: true; message: LiveMessage } | { ok: false; error: "send_failed" }> {
  const now = deps.now();
  const sent = await deps.sendTelegram(visitorPing(conv, text, false, now));
  if (!sent.ok) return { ok: false, error: "send_failed" };
  const { store } = deps;
  const message = await store.append(conv.id, { from: "visitor", text, t: now });
  if (sent.messageId) await store.mapTelegram(sent.messageId, conv.id);
  await Promise.all([
    store.updateConv(conv.id, { lastVisitorAt: now }),
    store.addPending(conv.id, now),
    store.incrStat(istDate(now), STAT.in),
  ]);
  return { ok: true, message };
}

export type ReplyOutcome = {
  n: number;
  /** What happened to the reply beyond the thread, for the note Vishal gets back in Telegram. */
  email: "sent" | "visitor_present" | "no_email" | "opted_out" | "no_sender" | "limit" | "failed";
};

/**
 * Vishal's reply (a Telegram reply to the visitor's message). It is added to the thread, and emailed if the visitor
 * has left the site, gave an address, hasn't opted out, and a sender is available.
 */
export async function ownerReply(
  convId: string,
  text: string,
  deps: Deps = defaultDeps(),
): Promise<ReplyOutcome | null> {
  const { store } = deps;
  const conv = await store.getConv(convId);
  if (!conv) return null;
  const now = deps.now();
  const message = await store.append(conv.id, { from: "vishal", text, t: now });
  await Promise.all([
    store.updateConv(conv.id, { lastOwnerAt: now }),
    store.removePending(conv.id),
    store.incrStat(istDate(now), STAT.out),
  ]);

  if (!conv.email) return { n: message.n, email: "no_email" };
  if (conv.optOut) return { n: message.n, email: "opted_out" };
  const seen = await store.lastSeen(conv.id);
  if (seen && now - seen < LIVE.presentMs) return { n: message.n, email: "visitor_present" };
  if (!deps.canEmail()) return { n: message.n, email: "no_sender" };
  if ((await store.countEmail(conv.id, istDate(now))) > LIVE.emailsPerDay)
    return { n: message.n, email: "limit" };
  try {
    await deps.emailReply(conv, text);
    await store.incrStat(istDate(now), STAT.emailed);
    return { n: message.n, email: "sent" };
  } catch (err) {
    console.error("[live] reply email failed:", (err as Error).message);
    return { n: message.n, email: "failed" };
  }
}

/** The visitor leaves an address after the fact ("he hasn't replied yet": add your email). */
export async function captureEmail(
  convId: string,
  email: string,
  org: string | null,
  deps: Deps = defaultDeps(),
): Promise<Conv | null> {
  const conv = await deps.store.updateConv(convId, { email, ...(org ? { org } : {}) });
  if (conv)
    await deps.sendTelegram(
      `✉ <code>#${conv.short}</code> ${escapeHtml(conv.name)} left an email: ${escapeHtml(email)}${
        deps.canEmail()
          ? ". Your replies will be emailed if they have left the site."
          : ". (Replies can't be emailed yet: no verified sender.)"
      }`,
    );
  return conv;
}

export async function blockConversation(shortOrId: string, deps: Deps = defaultDeps()): Promise<Conv | null> {
  const id = (await deps.store.idByShort(shortOrId.replace(/^#/, ""))) ?? shortOrId;
  const conv = await deps.store.getConv(id);
  if (!conv) return null;
  await Promise.all([
    deps.store.updateConv(conv.id, { blocked: true }),
    deps.store.blockIp(conv.ipHash),
    deps.store.removePending(conv.id),
  ]);
  return conv;
}

/* ── presence, stats, digest ─────────────────────────────────────────────────────────────────────── */

export async function runPresenceCommand(cmd: Command, arg: string, deps: Deps = defaultDeps()) {
  const now = deps.now();
  const { presence, ok } = applyCommand(await deps.store.getPresence(), cmd, arg, now);
  await deps.store.setPresence(presence);
  return { ok, presence, state: effectivePresence(presence, now) };
}

/** Anything he does in Telegram counts as being active. */
export async function noteOwnerActivity(deps: Deps = defaultDeps()) {
  await deps.store.setPresence(touch(await deps.store.getPresence(), deps.now()));
}

const ago = (from: number, now: number) => {
  const m = Math.max(0, Math.round((now - from) / 60_000));
  return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
};

export async function statsText(deps: Deps = defaultDeps(), title = "Today"): Promise<string> {
  const now = deps.now();
  const day = istDate(now);
  const s = await deps.store.getStats(day, [STAT.conv, STAT.grid, STAT.in, STAT.out, STAT.emailed]);
  const pending = await deps.store.listPending(5);
  const lines = await Promise.all(
    pending.map(async (p) => {
      const c = await deps.store.getConv(p.id);
      return c
        ? `• <code>#${c.short}</code> ${escapeHtml(c.name)}${c.org ? ` (${escapeHtml(c.org)})` : ""} · ${ago(p.at, now)}`
        : null;
    }),
  );
  const waiting = lines.filter((l): l is string => l !== null);
  return [
    `<b>${escapeHtml(title)}</b> · ${day} (IST)`,
    `Live chats started: ${s[STAT.conv]} · messages from GRID's card: ${s[STAT.grid]}`,
    `Visitor messages: ${s[STAT.in]} · your replies: ${s[STAT.out]} · reply emails: ${s[STAT.emailed]}`,
    waiting.length > 0
      ? `\nWaiting for your reply:\n${waiting.join("\n")}`
      : "\nNothing is waiting for a reply.",
    "\nPage views and résumé downloads are in Vercel Analytics.",
  ].join("\n");
}
