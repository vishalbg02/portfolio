import "server-only";
import { env } from "@/lib/env";
import { istStamp } from "@/lib/email/templates";
import { site } from "@/lib/site";

/** Telegram's HTML mode needs only these three escaped. Everything a visitor typed goes through this. */
export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type OwnerPing = { name: string; email: string; message: string; page?: string };

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
 * it: the caller only learns whether it worked.
 */
export async function sendTelegram(text: string, doFetch: Fetch = fetch): Promise<boolean> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chat = env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;
  try {
    const res = await doFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        text: text.slice(0, 4000),
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("[notify] telegram answered", res.status);
    return res.ok;
  } catch (err) {
    console.error("[notify] telegram failed:", (err as Error).name);
    return false;
  }
}
