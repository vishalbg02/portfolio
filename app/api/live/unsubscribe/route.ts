import { features } from "@/lib/env";
import { defaultDeps } from "@/lib/live/service";
import { verify } from "@/lib/live/token";

const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body style="margin:0;background:#0d1117;color:#e6edf3;font:16px/1.6 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh"><main style="max-width:30rem;padding:1.5rem"><h1 style="font-size:1.25rem">${title}</h1><p style="color:#8b949e">${body}</p></main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

async function stop(c: string, k: string) {
  if (!features.live || !/^[0-9a-f-]{36}$/.test(c) || !verify(c, k)) return false;
  const conv = await defaultDeps().store.updateConv(c, { optOut: true });
  return conv !== null;
}

/** The link in a reply email. One click, no sign-in; the signature proves it is the visitor's link. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  return (await stop(u.searchParams.get("c") ?? "", u.searchParams.get("k") ?? ""))
    ? page(
        "No more emails",
        "You won't get any more emails about this conversation. Nothing else will be sent.",
      )
    : page("That link didn't work", "It may have expired (threads are deleted after 30 days).", 404);
}

/** Mail programs' one-click unsubscribe (RFC 8058). */
export async function POST(req: Request) {
  const u = new URL(req.url);
  return (await stop(u.searchParams.get("c") ?? "", u.searchParams.get("k") ?? ""))
    ? new Response(null, { status: 200 })
    : new Response(null, { status: 404 });
}
