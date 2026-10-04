# Live chat setup (about 10 minutes)

Live chat lets a visitor message you on the site and you answer from your phone, in Telegram. It is built (Phase 4). Every
variable is optional: until they are set the "Message Vishal" button offers "Leave a message" (GRID's message card) and
nothing else changes.

| Step | What                                                         | Who                        |
| ---- | ------------------------------------------------------------ | -------------------------- |
| 1    | Create a Telegram bot                                        | you (done)                 |
| 2    | Find your chat id                                            | you (done)                 |
| 3    | Three random secrets                                         | you (done)                 |
| 4    | A free Upstash Redis database                                | you (done)                 |
| 5    | The values in `.env.local` and in Vercel                     | you (done)                 |
| 6    | Register the webhook (`pnpm telegram:setup`)                 | after this version is live |
| 7    | Optional: a bot check (Cloudflare Turnstile)                 | you, only if you get spam  |
| 8    | Optional: a verified email sender, so replies can be emailed | you, see below             |

> **Keep the bot token secret.** Anyone who has it can control your bot. If it ever leaks, send `/revoke` to @BotFather and
> make a new one, then update `.env.local` and Vercel, and run step 6 again.

## 1–5. Accounts and variables

These are in [the original steps below](#appendix-steps-1-5), unchanged. The variables are:

```
TELEGRAM_BOT_TOKEN=          TELEGRAM_CHAT_ID=
TELEGRAM_WEBHOOK_SECRET=     LIVE_CHAT_SIGNING_SECRET=     CRON_SECRET=
UPSTASH_REDIS_REST_URL=      UPSTASH_REDIS_REST_TOKEN=
```

Live chat switches on when **the first six** are set (it needs somewhere to keep threads, a way to reach you, and secrets to
sign links and verify Telegram). `CRON_SECRET` only adds the daily digest.

## 6. Register the webhook

Do this **after** the version with live chat is deployed to the address you want (Telegram will call it).

```bash
pnpm telegram:setup            # for https://vishalbg.vercel.app
pnpm telegram:setup --check    # what is registered, and any error Telegram saw
```

It tells Telegram to send everything written to your bot to `/api/telegram/webhook` (proved with your
`TELEGRAM_WEBHOOK_SECRET`) and adds the command menu. It warns you if the site isn't deployed with live chat yet.

Then, in Telegram, open your bot and send **/online**. Open the site in a private window, press **Message Vishal** (Contact
section, ⌘K, or GRID), and send a message. It arrives in Telegram starting with a 💬 line. **Swipe-reply to that message** to
answer: your reply appears in the visitor's chat within a few seconds.

## What you can do from Telegram

| Command             | What it does                                                                                                                                                                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/online`           | You're reachable. After 20 minutes without any message from you, you're shown as away again.                                                                                                                                                                                                 |
| `/away`             | You're away until you send `/online`. Visitors are asked to leave a message and an email.                                                                                                                                                                                                    |
| `/hours 10-22`      | Online whenever it is between those hours in Bengaluru, whatever else you do. `/hours off` clears.                                                                                                                                                                                           |
| `/stats`            | Today's counts (chats, messages, replies, reply emails) and who is waiting for you.                                                                                                                                                                                                          |
| `/block a1b2c3`     | Blocks that visitor (the id is in the 💬 line) and their address.                                                                                                                                                                                                                            |
| `/help`             | The list.                                                                                                                                                                                                                                                                                    |
| `/link Infosys SDE` | A personal link for a company: `https://vishalbg.vercel.app/?c=<code>`, good for 90 days. For a longer name use `\|`: `/link Tata Consultancy \| Java Developer`. You are told here when it is opened (once per 6 hours), when the résumé is downloaded from it and when GRID starts a chat. |
| `/links`            | Your last ten links and how many times each was opened.                                                                                                                                                                                                                                      |

A **daily digest** arrives at about 21:00 IST with the same numbers (Vercel's cron runs once a day, anywhere within an
hour; it needs `CRON_SECRET`, which Vercel then sends automatically).

You always reply by **replying to the visitor's message**. A message that isn't a reply gets a reminder, so nothing goes to the
wrong person. Replies to a GRID "message card" message work the same way.

## How a visitor's reply reaches them

- **They stay on the page:** the chat asks for new messages every few seconds (slower when quiet, slowest in a hidden tab, not at
  all after 30 minutes of silence), so your reply appears within seconds. It costs one Redis read per ask, well inside Upstash's
  free 500,000 commands a month.
- **They leave, and gave an email:** your reply is emailed to them with a link back to the thread and a one-click "stop emails".
  Telegram doesn't tell a bot when someone is typing, so the chat can't show "Vishal is typing". It shows "Delivered" instead.
- **They gave no email and left:** they see your reply if they come back in the same browser (their thread is remembered there).

## 8. Emailing replies needs a verified sender

Resend's shared sender (`onboarding@resend.dev`) can only deliver to **your own** address, so replies **can't be emailed to
visitors** until you have a sender on a domain you control and have verified in Resend. Until then, when a visitor has left,
the bot tells you _"replies can't be emailed yet"_ and shows you their address so you can write to them yourself. When you
have a domain: verify it in Resend, then set `CONTACT_FROM_EMAIL="Vishal <hello@yourdomain>"` in `.env.local` and Vercel.
Nothing else changes. (This is the same sender the contact form's confirmation email uses.)

## 7. Optional: a bot check

Rate limits (5 chats per visitor per day, 30 messages per hour per chat, 100 chats a day overall), a hidden trap field,
length and link limits are always on. If spam gets through anyway, add a free Cloudflare Turnstile widget:

1. <https://dash.cloudflare.com> → Turnstile → add a widget for your site (managed mode).
2. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in `.env.local` and Vercel, and redeploy (the site key is
   read at build time; it also adds Cloudflare to the page's security policy, and only then).

Only a visitor's first message is checked.

## Privacy

Messages go to your phone; threads are kept in Redis for 30 days and then deleted; an email is optional and only used to send
your reply; only a salted hash of the visitor's address is kept (to block abuse). The page [/privacy](/privacy) says all of this
in plain words. Please don't answer anything sensitive in the chat either.

## If something looks wrong

- `pnpm telegram:setup --check` shows the registered address and the last error Telegram got from it.
- Messages from the site don't arrive: is the bot token right (`pnpm telegram:setup --chat-id` prints the bot's name), and did you
  press Start in the bot? `TELEGRAM_CHAT_ID` must be the id of **your** private chat with it.
- Your reply says "I couldn't match that to a visitor": reply to the visitor's 💬 message (swipe it), and note threads older than
  30 days are gone.
- The button still says "Leave a message": one of the six variables is missing in Vercel, or it hasn't redeployed since you
  added them (variables are read at build and start).
- You changed a variable in Vercel but nothing changed: redeploy.

## Appendix: steps 1-5

1. **Create the bot.** In Telegram, @BotFather → `/newbot` → a name, and a username ending in `bot`. It returns an HTTP API token
   (`TELEGRAM_BOT_TOKEN`).
2. **Your chat id.** Open your bot, press Start, send it any message, then run `pnpm telegram:setup --chat-id` (before the webhook
   is registered). It prints `TELEGRAM_CHAT_ID`.
3. **Secrets.** `openssl rand -hex 24` for `TELEGRAM_WEBHOOK_SECRET`, `openssl rand -hex 32` for `LIVE_CHAT_SIGNING_SECRET`,
   `openssl rand -hex 24` for `CRON_SECRET` (a different one each time).
4. **Upstash Redis.** A free database at <https://upstash.com>; copy the REST URL and token (`UPSTASH_REDIS_REST_URL`,
   `UPSTASH_REDIS_REST_TOKEN`). They also power the shared rate limits.
5. **Variables.** Put all of them in `.env.local` and in Vercel → Settings → Environment Variables (Production and Preview), then redeploy.
