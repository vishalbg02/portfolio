import "server-only";
import { NextResponse } from "next/server";
import { site } from "@/lib/site";

/** Shared by the API routes. */
export const json = (body: Record<string, unknown>, status = 200, headers?: HeadersInit) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

/** Browsers always send Origin on cross-site POSTs; reject anything that isn't this site. curl (no Origin) is allowed. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const o = new URL(origin);
    return o.host === req.headers.get("host") || o.origin === site.url || o.hostname === "localhost";
  } catch {
    return false;
  }
}

/** Reads a request body as text, refusing anything over `maxBytes` (also via Content-Length). */
export async function readBody(
  req: Request,
  maxBytes: number,
): Promise<{ ok: true; text: string } | { ok: false }> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return { ok: false };
  const text = await req.text();
  return text.length > maxBytes ? { ok: false } : { ok: true, text };
}
