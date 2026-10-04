import "server-only";
import { env } from "@/lib/env";
import { cleanText } from "@/lib/notify/message";
import { claimOnce } from "@/lib/notify/once";
import { escapeHtml } from "@/lib/notify/telegram";
import { parseHours } from "./presence";
import {
  blockConversation,
  defaultDeps,
  noteOwnerActivity,
  ownerReply,
  runPresenceCommand,
  statsText,
  type Deps,
  type ReplyOutcome,
} from "./service";
import { LIVE } from "./types";

/** The part of a Telegram update this handles: a private message, possibly a reply. */
export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; type: string };
    reply_to_message?: { message_id: number };
  };
};

export const HELP = [
  "<b>GRID live chat</b>",
  "Reply to a visitor's message (swipe it) to answer them.",
  "",
  "/online: you're reachable (auto-away after 20 min of silence)",
  "/away: you're away until /online",
  "/hours 10-22: online between those Bengaluru hours (/hours off to clear)",
  "/stats: today's counts and who's waiting",
  "/block &lt;id&gt;: block a visitor (the id looks like #a1b2c3)",
  "/link &lt;Company&gt; [Role]: personal links (coming in a later update)",
  "/help: this list",
].join("\n");

const EMAIL_NOTE: Record<ReplyOutcome["email"], string> = {
  sent: "They'd left the site, so I emailed it too.",
  visitor_present: "They're on the site right now.",
  no_email: "They didn't leave an email, so they'll see it if they come back.",
  opted_out: "They've stopped emails about this thread.",
  no_sender: "They left the site, but replies can't be emailed yet (no verified sender).",
  limit: "I've emailed them enough today, so this one wasn't.",
  failed: "I tried to email it but the email service refused.",
};

/** "/hours@MyBot 10-22" → { cmd: "hours", arg: "10-22" } */
export function parseCommand(text: string): { cmd: string; arg: string } | null {
  const m = /^\/([a-z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i.exec(text.trim());
  return m ? { cmd: m[1]!.toLowerCase(), arg: (m[2] ?? "").trim() } : null;
}

const say = (deps: Deps, text: string, replyTo?: number) => deps.sendTelegram(text, { replyTo });

/**
 * One Telegram update. Only Vishal's own private chat is ever obeyed (anyone else who finds the bot is ignored without
 * an answer), and each update id is handled once, because Telegram retries a webhook that was slow to answer.
 */
export async function handleUpdate(update: TelegramUpdate, deps: Deps = defaultDeps()): Promise<string> {
  const msg = update.message;
  if (!msg || typeof msg.text !== "string") return "ignored";
  if (String(msg.chat.id) !== env.TELEGRAM_CHAT_ID || msg.chat.type !== "private") return "ignored";
  if (!(await claimOnce(`tgupd:${update.update_id}`, 86_400))) return "duplicate";

  const command = parseCommand(msg.text);
  if (command) {
    switch (command.cmd) {
      case "start":
      case "help":
        await noteOwnerActivity(deps);
        await say(deps, HELP);
        return "help";
      case "online": {
        await runPresenceCommand("online", "", deps);
        await say(
          deps,
          "● You're online. I'll switch you to away after 20 minutes without a message from you.",
        );
        return "online";
      }
      case "away": {
        await runPresenceCommand("away", "", deps);
        await say(
          deps,
          "◐ You're away. Visitors are asked to leave a message. Send /online when you're back.",
        );
        return "away";
      }
      case "hours": {
        const { ok } = await runPresenceCommand("hours", command.arg, deps);
        const h = /^\s*(off|none|clear)\s*$/i.test(command.arg) ? null : parseHours(command.arg);
        await say(
          deps,
          ok
            ? h
              ? `⏰ Online between ${h.from}:00 and ${h.to}:00 Bengaluru time, whatever else you do. /hours off clears it.`
              : "⏰ Hours cleared. You're online for 20 minutes after you last message me, or after /online."
            : "Use /hours 10-22 (Bengaluru time, 24-hour) or /hours off.",
        );
        return ok ? "hours" : "hours_invalid";
      }
      case "stats":
        await noteOwnerActivity(deps);
        await say(deps, await statsText(deps));
        return "stats";
      case "block": {
        await noteOwnerActivity(deps);
        const conv = command.arg ? await blockConversation(command.arg, deps) : null;
        await say(
          deps,
          conv
            ? `⛔ Blocked #${conv.short} (${escapeHtml(conv.name)}). They can't start new chats.`
            : "Use /block followed by the id from a visitor's message, like /block a1b2c3.",
        );
        return conv ? "block" : "block_unknown";
      }
      case "link":
        await noteOwnerActivity(deps);
        await say(deps, "Personal company links arrive in a later update. Nothing was created.");
        return "link";
      default:
        await noteOwnerActivity(deps);
        await say(deps, HELP);
        return "help";
    }
  }

  // A reply to one of the visitor messages we sent him.
  const replyTo = msg.reply_to_message?.message_id;
  if (!replyTo) {
    await noteOwnerActivity(deps);
    await say(
      deps,
      "Reply to a visitor's message so I know who it's for. /help lists the commands.",
      msg.message_id,
    );
    return "not_a_reply";
  }
  const convId = await deps.store.convForTelegram(replyTo);
  const text = cleanText(msg.text).slice(0, LIVE.message.max);
  if (!convId || !text) {
    await noteOwnerActivity(deps);
    await say(
      deps,
      "I couldn't match that to a visitor (the thread may be older than 30 days).",
      msg.message_id,
    );
    return "unmatched";
  }
  await noteOwnerActivity(deps);
  const outcome = await ownerReply(convId, text, deps);
  if (!outcome) {
    await say(deps, "That thread has expired.", msg.message_id);
    return "unmatched";
  }
  const conv = await deps.store.getConv(convId);
  const who = conv ? escapeHtml(conv.name) : "the visitor";
  const extra = outcome.email === "no_sender" && conv?.email ? ` Their email: ${escapeHtml(conv.email)}` : "";
  await say(deps, `✓ Sent to ${who}. ${EMAIL_NOTE[outcome.email]}${extra}`, msg.message_id);
  return "reply";
}
