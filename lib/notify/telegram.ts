import "server-only";
import { env } from "@/lib/env";
import { istStamp } from "@/lib/email/templates";
import { site } from "@/lib/site";

/** Telegram's HTML mode needs only these three escaped. Everything a visitor typed goes through this. */
export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type OwnerPing = { name: string; email: string; message: string; page?: string; ipHash?: string };

/**
 * What lands on Vishal's phone. The visitor's text is escaped and placed after a fixed header; Telegram caps a message
 * at 4,096 characters and the validated message is at most 1,500.
 */
export function ownerPing(m: OwnerPing, now: Date = new Date()): string {
  return [
    "💬 <b>New message via GRID</b>",
    `<b>From:</b> ${escapeHtml(m.name)} &lt;${escapeHtml(m.email)}&gt;`,
    m.page ? `<b>Page:</b> ${escapeHtml(site.url.replace(/^https?:\/\//, ""))}${escapeHtml(m.page)}` : null,
    `<b>Sent:</b> ${escapeHtml(istStamp(now))}`,
    "",
    escapeHtml(m.message),
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

type Fetch = typeof fetch;

/**
 * Sends one message to Vishal's chat. Never throws and never returns the token or any error detail that could contain
 * it: the caller only learns whether it worked, and the id Telegram gave the message (replies are matched by it).
 */
export async function sendTelegramMessage(
  text: string,
  opts: { replyTo?: number } = {},
  doFetch: Fetch = fetch,
): Promise<{ ok: boolean; messageId?: number }> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chat = env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return { ok: false };
  try {
    const res = await doFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        text: text.slice(0, 4000),
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        ...(opts.replyTo
          ? { reply_parameters: { message_id: opts.replyTo, allow_sending_without_reply: true } }
          : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[notify] telegram answered", res.status);
      return { ok: false };
    }
    const body = (await res.json().catch(() => null)) as { result?: { message_id?: number } } | null;
    return { ok: true, messageId: body?.result?.message_id };
  } catch (err) {
    console.error("[notify] telegram failed:", (err as Error).name);
    return { ok: false };
  }
}

export async function sendTelegram(text: string, doFetch: Fetch = fetch): Promise<boolean> {
  return (await sendTelegramMessage(text, {}, doFetch)).ok;
}
