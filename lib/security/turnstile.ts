import "server-only";
import { env } from "@/lib/env";

/**
 * Cloudflare Turnstile (the bot check on a first message). When no secret key is set the check is simply off, and the
 * honeypot, rate limits and caps that are always on are what protect the chat. With a key set, a missing or rejected
 * token fails, and so does an unreachable Cloudflare: a visitor can still use the contact form.
 */
export async function verifyTurnstile(
  token: string | undefined,
  ip: string | null,
  doFetch: typeof fetch = fetch,
): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await doFetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
