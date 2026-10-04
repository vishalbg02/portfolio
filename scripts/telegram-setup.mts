/**
 * One-time setup for the live chat's Telegram bot (docs/LIVE-CHAT-SETUP.md, step 6).
 *
 *   pnpm telegram:setup --chat-id     print the chat id(s) that have messaged the bot (works only before a webhook is set)
 *   pnpm telegram:setup               register the webhook and the command list for https://vishalbg.vercel.app
 *   pnpm telegram:setup --url <site>  …for another address (a preview deployment)
 *   pnpm telegram:setup --check       show what is registered
 *   pnpm telegram:setup --remove      delete the webhook
 *
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from the environment or from .env.local. The token is never printed.
 */
import { existsSync, readFileSync } from "node:fs";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(?:"(.*)"|(.*))$/.exec(line.trim());
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2] ?? m[3] ?? "";
  }
}
loadEnvLocal();

const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const urlArg = args.indexOf("--url") >= 0 ? args[args.indexOf("--url") + 1] : undefined;
const site = (urlArg ?? process.env.SITE_URL ?? "https://vishalbg.vercel.app").replace(/\/$/, "");

const COMMANDS = [
  { command: "online", description: "I'm reachable (auto-away after 20 min of silence)" },
  { command: "away", description: "I'm away until /online" },
  { command: "hours", description: "Online between Bengaluru hours, e.g. /hours 10-22" },
  { command: "stats", description: "Today's counts and who is waiting" },
  { command: "block", description: "Block a visitor: /block a1b2c3" },
  { command: "link", description: "Personal company link (coming later)" },
  { command: "help", description: "List the commands" },
];

async function api<T = unknown>(
  method: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; result?: T; description?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return (await res.json()) as { ok: boolean; result?: T; description?: string };
}

const fail = (msg: string): never => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

if (!token) fail("TELEGRAM_BOT_TOKEN is not set (put it in .env.local or the environment).");

const me = await api<{ username: string }>("getMe");
if (!me.ok)
  fail(
    `Telegram refused the token (${me.description ?? "unknown"}). Copy it again from @BotFather, with no spaces.`,
  );
console.log(`✓ bot: @${me.result!.username}`);

if (flag("chat-id")) {
  const u =
    await api<
      Array<{ message?: { chat: { id: number; type: string; first_name?: string; username?: string } } }>
    >("getUpdates");
  if (!u.ok) fail(u.description ?? "getUpdates failed (a webhook is set: run with --remove first)");
  const chats = new Map<number, string>();
  for (const x of u.result ?? []) {
    const c = x.message?.chat;
    if (c?.type === "private")
      chats.set(c.id, [c.first_name, c.username ? `@${c.username}` : ""].filter(Boolean).join(" "));
  }
  if (chats.size === 0)
    fail("No messages yet. Open the bot in Telegram, press Start, send it any message, then run this again.");
  for (const [id, who] of chats) console.log(`TELEGRAM_CHAT_ID=${id}   (${who})`);
  process.exit(0);
}

if (flag("check")) {
  const info = await api<Record<string, unknown>>("getWebhookInfo");
  const r = info.result ?? {};
  console.log(`webhook: ${r.url || "(none)"}`);
  console.log(
    `pending updates: ${r.pending_update_count ?? 0}${r.last_error_message ? ` · last error: ${r.last_error_message}` : ""}`,
  );
  process.exit(0);
}

if (flag("remove")) {
  const r = await api("deleteWebhook");
  console.log(r.ok ? "✓ webhook removed" : `✗ ${r.description}`);
  process.exit(r.ok ? 0 : 1);
}

if (!secret) fail("TELEGRAM_WEBHOOK_SECRET is not set (docs/LIVE-CHAT-SETUP.md, step 3).");

// The deployed site must already have the live chat and its environment variables, or Telegram would call a missing route.
try {
  const p = (await (await fetch(`${site}/api/live/presence`)).json()) as { configured?: boolean };
  if (!p.configured)
    console.warn(
      `⚠ ${site} says live chat is not configured yet. Deploy this version with the environment variables set, then run this again.`,
    );
} catch {
  console.warn(`⚠ couldn't reach ${site}/api/live/presence. Is the address right, and is the site deployed?`);
}

const hook = await api("setWebhook", {
  url: `${site}/api/telegram/webhook`,
  secret_token: secret,
  allowed_updates: ["message"],
  max_connections: 5,
});
if (!hook.ok) fail(`setWebhook: ${hook.description}`);
console.log(`✓ webhook: ${site}/api/telegram/webhook`);

const cmds = await api("setMyCommands", { commands: COMMANDS });
console.log(
  cmds.ok
    ? `✓ commands: ${COMMANDS.map((c) => `/${c.command}`).join(" ")}`
    : `✗ setMyCommands: ${cmds.description}`,
);
console.log("\nNow open the bot in Telegram and send /online, then try the chat on the site.");
