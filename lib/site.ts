/**
 * Public, client-safe site configuration. Values are inlined at build time.
 */
const DEFAULT_SITE_URL = "https://vishalbg.vercel.app";

function normalizeUrl(value: string | undefined): string {
  try {
    return new URL(value || DEFAULT_SITE_URL).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const site = {
  url: normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL),
  repo: "https://github.com/vishalbg02/portfolio",
  wordmark: "~/vishalbg",
  buildTime: process.env.NEXT_PUBLIC_BUILD_TIME ?? null,
  commitSha: process.env.NEXT_PUBLIC_COMMIT_SHA || null,
  gscVerification: process.env.NEXT_PUBLIC_GSC_VERIFICATION || null,
} as const;

/**
 * Routes that have shipped. Nav, palette and sitemap read this so nothing links to a 404.
 * Flip a flag in the phase that ships the route.
 */
export const shipped = {
  caseStudies: false, // Phase 3
  log: false, // Phase 6
  now: false, // Phase 6
  recruiter: false, // Phase 6
  terminal: false, // Phase 7
} as const;

export const navLinks: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Work", href: "/#work" },
  { label: "Experience", href: "/#experience" },
  ...(shipped.log ? [{ label: "Log", href: "/log" }] : []),
  ...(shipped.now ? [{ label: "Now", href: "/now" }] : []),
  { label: "Contact", href: "/#contact" },
];

export const resumeHref = "/resume.pdf";
