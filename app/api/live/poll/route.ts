import { features } from "@/lib/env";
import { json } from "@/lib/http";
import { defaultDeps } from "@/lib/live/service";
import { verify } from "@/lib/live/token";

/**
 * The browser asks "anything new?" with the version it last saw. Unchanged costs one Redis read (plus noting that the
 * visitor is on the site); changed returns the new messages. The signed token is the access check, so there is no
 * lookup of the conversation on an ordinary poll.
 */
export async function GET(req: Request) {
  if (!features.live) return json({ error: "not_configured" }, 503);
  const url = new URL(req.url);
  const c = url.searchParams.get("c") ?? "";
  const k = url.searchParams.get("k") ?? "";
  const after = Math.max(0, Math.floor(Number(url.searchParams.get("after") ?? 0)) || 0);
  const seenVersion = Math.max(0, Math.floor(Number(url.searchParams.get("v") ?? -1)));
  if (!/^[0-9a-f-]{36}$/.test(c) || !verify(c, k)) return json({ error: "forbidden" }, 403);

  const deps = defaultDeps();
  const [version] = await Promise.all([deps.store.version(c), deps.store.touchSeen(c, deps.now())]);
  if (version === 0 && after > 0) return json({ error: "gone" }, 404); // expired (30 days) or deleted
  if (version === seenVersion) return json({ changed: false, v: version });
  return json({ changed: true, v: version, messages: await deps.store.messages(c, after) });
}
