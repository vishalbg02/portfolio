import { features } from "@/lib/env";
import { currentPresence } from "@/lib/live/read";
import { profile } from "@/content/profile";
import { json } from "@/lib/http";
import { presenceView } from "@/lib/live/presence";

/** Online or away, for the chip. Cached at the edge for 15 seconds so a busy page costs one read, not one per visitor. */
export async function GET() {
  const cache = { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" };
  const email = profile.contact.email;
  if (!features.live) return json({ ...presenceView(null, Date.now(), false), email }, 200, cache);
  try {
    return json({ ...(await currentPresence()), email }, 200, cache);
  } catch {
    return json({ ...presenceView(null, Date.now(), true), email }, 200, cache); // Redis hiccup: say away, never fail the page
  }
}
