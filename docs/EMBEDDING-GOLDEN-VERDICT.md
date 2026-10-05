# Showing the live Golden Verdict site in the portfolio

The Work section and the Golden Verdict case study can show the **real, running site** in a frame, the same way they
already show the CHRIST Virtual Tour. Today they show real captures and a "Visit live site ↗" button instead, because
Golden Verdict tells browsers never to frame it.

**Nothing in this portfolio needs to change.** It already checks the site's headers every five minutes
(`/api/status`, `lib/status/frame.ts`). The moment the site allows framing, "Launch live site ▶" appears by itself.
Golden Verdict's origins are already in this site's CSP `frame-src` (`lib/security/embeds.ts`), so no deploy is needed
here.

## Why it is blocked today

Read from the Golden Verdict repository (not changed from here):

- `next.config.js` sends `X-Frame-Options: DENY` on every route.
- The middleware's per-request CSP has no `frame-ancestors` directive.

`DENY` means no other site may frame it.

## The change, on the Golden Verdict site only

> **This is a client's production site. Make this change only with the client's permission.**

1. **Middleware CSP:** add one directive, listing who may frame the site:

   ```
   frame-ancestors 'self' https://vishalbg.vercel.app
   ```

   Add a custom domain here too if the portfolio ever gets one.

2. **`next.config.js`:** remove the `X-Frame-Options: DENY` entry from `securityHeaders`.
   - Modern browsers ignore `X-Frame-Options` when `frame-ancestors` is present.
   - Some older ones only read `X-Frame-Options`, and with `DENY` left in place they would still refuse.
   - `X-Frame-Options` cannot name another site, so `frame-ancestors` is the only way to allow exactly one.

Everyone else is still refused, so the site keeps its clickjacking protection.

## What happens on the portfolio after the change

- Within five minutes, `/api/status` reports `embeddable: true` for Golden Verdict.
- The Work scene and the case study show **Launch live site ▶**. On click, the site loads in a sandboxed frame:
  - `allow-scripts allow-same-origin allow-forms allow-popups`;
  - no referrer;
  - full-screen toggle and "Open in new tab ↗".
- Nothing is requested from Golden Verdict until the visitor clicks.
- If the site is down, the portfolio goes back to captures with an "offline right now" note. It never shows a broken
  frame.

## Checking it

```bash
curl -sI https://www.goldenverdict.com/ | grep -iE "x-frame-options|content-security-policy"
```

The CSP line should contain `frame-ancestors 'self' https://vishalbg.vercel.app`, and there should be no
`X-Frame-Options` line. Then look for `"embeddable":true` in `https://vishalbg.vercel.app/api/status` (it can take up to
five minutes).
