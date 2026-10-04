# Live chat setup (about 10 minutes)

Live chat lets a visitor message you on the site and you answer from your phone, in Telegram. It is built in **Phase 4**.
You can do all the account work below **now**, so it is ready when the code lands. Every variable is optional: until they
are set the site shows "Leave a message" and uses the contact form, exactly as it does today.

| Step | What                                         | Who                | Status                                        |
| ---- | -------------------------------------------- | ------------------ | --------------------------------------------- |
| 1    | Create a Telegram bot                        | you                | do now                                        |
| 2    | Find your chat id                            | you                | do now                                        |
| 3    | Generate three random secrets                | you                | do now                                        |
| 4    | Create a free Upstash Redis database         | you                | do now (skip if you already have one set)     |
| 5    | Put the values in `.env.local` and in Vercel | you                | do now                                        |
| 6    | Register the webhook (`pnpm telegram:setup`) | **me, in Phase 4** | **not in the repo yet, do not do it by hand** |

> **Keep the bot token secret.** Anyone who has it can control your bot. You do not need to paste it into this chat:
> put it in `.env.local` and Vercel yourself (step 5) and I will read it from there. If it ever leaks, send `/revoke` to
> @BotFather and make a new one.

## 1. Create the bot

1. In Telegram, search for **@BotFather** (the one with the blue verified tick) and press **Start**.
2. Send `/newbot`.
3. It asks for a **name** (shown in chats): for example `Vishal's Portfolio`.
4. It asks for a **username**: it must be unique and **end in `bot`**, for example `vishalbg_portfolio_bot`.
5. BotFather replies with an **HTTP API token** that looks like `123456789:AA…`. That is `TELEGRAM_BOT_TOKEN`.

## 2. Find your chat id

1. Open your new bot in Telegram, press **Start**, and send it any message, for example `hello`. (A bot can only see you
   after you have written to it first.)
2. In a browser, open this address, with your own token in place of `<TOKEN>`:

   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```

3. Find `"chat":{"id":123456789,…`. That number is `TELEGRAM_CHAT_ID`. (If the result is `[]`, send the bot another
   message and reload the page.)

## 3. Generate the secrets

In a terminal:

```bash
openssl rand -hex 24   # TELEGRAM_WEBHOOK_SECRET
openssl rand -hex 32   # LIVE_CHAT_SIGNING_SECRET
openssl rand -hex 24   # CRON_SECRET
```

Run it once per secret, so each one is different.

## 4. Upstash Redis

Live chat keeps conversations in Redis (they are deleted after 30 days). If `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` are already set in Vercel (they also power the shared rate limits), skip this step.

1. Create a free account and a **Redis** database at <https://upstash.com> (pick a region close to you).
2. On the database page, copy the **REST URL** and the **REST token**.

The free plan allows 500,000 commands a month. Live chat is designed to stay far below that: it polls a single
version key, and only while a chat is open and the tab is visible.

## 5. Put the values in `.env.local` and in Vercel

Add these to `.env.local` (copy the names from `.env.example`; it is already git-ignored):

```
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_WEBHOOK_SECRET=
LIVE_CHAT_SIGNING_SECRET=
CRON_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Then add the same names and values in **Vercel → your project → Settings → Environment Variables**, for both
**Production** and **Preview**. A new deployment is needed for Vercel to pick them up.

Optional, only if you want a bot check on the first message (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` and
`TURNSTILE_SECRET_KEY`): create a free Cloudflare Turnstile widget at <https://dash.cloudflare.com>. Rate limits, a
honeypot and content caps are always on, with or without it.

## 6. What happens in Phase 4 (not yet)

I will add `pnpm telegram:setup`, which registers the webhook (with your `TELEGRAM_WEBHOOK_SECRET`) and the command list
(`/online`, `/away`, `/hours`, `/link`, `/stats`, `/block`, `/help`). Until then there is nothing to register, and
registering a webhook by hand would point Telegram at a route that does not exist yet.

Once it is live you reply to a visitor by **replying to their message in Telegram**; the site matches your reply to the
conversation.

## If something looks wrong

- `getUpdates` shows `[]`: you have not messaged the bot yet, or a webhook is already set for it. Message the bot again.
- The token is rejected (`401`): copy it again from BotFather, with no spaces.
- You changed a variable in Vercel but nothing changed: redeploy; environment variables are read at build and start.
