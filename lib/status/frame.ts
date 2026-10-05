/**
 * Would a browser let `embedder` show this response in an iframe? Read from the response's own headers, the same way a
 * browser decides: CSP `frame-ancestors` when the site sends it (it overrides X-Frame-Options), otherwise
 * X-Frame-Options. Pure, so it is unit-tested with header fixtures; `/api/status` runs it on Vercel, next to the probe.
 *
 * Anything unclear counts as "no": the page then shows real captures and a link, never a frame the browser refuses.
 */
export type FrameReason = "frame-ancestors" | "x-frame-options" | "none";
export type FrameVerdict = { embeddable: boolean; reason: FrameReason };

type HeaderSource = { get(name: string): string | null };

/** Does one `frame-ancestors` source expression allow `embedder` (an origin such as https://vishalbg.vercel.app)? */
function sourceAllows(source: string, embedder: URL): boolean {
  const s = source.trim().toLowerCase();
  if (s === "*") return true;
  if (s === "'none'" || s === "'self'" || s.startsWith("'")) return false; // 'self' is the framed site, not us
  if (/^[a-z][a-z0-9+.-]*:$/.test(s)) return s === embedder.protocol; // a scheme source, e.g. https:
  const m = /^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*\.)?([^/:]+|\*)(?::(\d+|\*))?(?:\/.*)?$/.exec(s);
  if (!m) return false;
  const [, scheme, wildcard, host, port] = m;
  if (scheme && `${scheme}:` !== embedder.protocol) return false;
  if (!scheme && embedder.protocol !== "https:") return false; // a bare host means the framed page's scheme: https
  if (port && port !== "*" && port !== (embedder.port || (embedder.protocol === "https:" ? "443" : "80")))
    return false;
  if (host === "*") return true;
  if (wildcard) return embedder.hostname.endsWith(`.${host}`);
  return embedder.hostname === host;
}

/** The sources of each policy's `frame-ancestors`. A header can carry several policies, separated by commas. */
function frameAncestors(csp: string): string[][] {
  return csp
    .split(",")
    .map((policy) =>
      policy
        .split(";")
        .map((d) => d.trim().split(/\s+/))
        .find(([name]) => name?.toLowerCase() === "frame-ancestors"),
    )
    .filter((d): d is string[] => d !== undefined)
    .map(([, ...sources]) => sources);
}

export function framing(headers: HeaderSource, embedderOrigin: string): FrameVerdict {
  let embedder: URL;
  try {
    embedder = new URL(embedderOrigin);
  } catch {
    return { embeddable: false, reason: "none" };
  }
  const policies = frameAncestors(headers.get("content-security-policy") ?? "");
  if (policies.length > 0) {
    // every policy must allow it; an empty frame-ancestors list allows nothing
    const ok = policies.every((sources) => sources.some((src) => sourceAllows(src, embedder)));
    return { embeddable: ok, reason: "frame-ancestors" };
  }
  const xfo = headers.get("x-frame-options");
  // DENY and SAMEORIGIN refuse us; ALLOW-FROM is obsolete (browsers disagree about it), so it counts as a refusal
  if (xfo && xfo.trim() !== "") return { embeddable: false, reason: "x-frame-options" };
  return { embeddable: true, reason: "none" };
}
