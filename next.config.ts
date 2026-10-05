import type { NextConfig } from "next";
import { countVisiblePosts } from "./lib/content/log-meta";
import { buildCsp } from "./lib/security/csp";

const isDev = process.env.NODE_ENV === "development";

const csp = buildCsp({
  isDev,
  isPreview: process.env.VERCEL_ENV === "preview",
  turnstile: Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
});

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // The home page is where most visits start: merge its client chunks more eagerly, so its first load makes fewer
    // requests (each one before the hero paints adds to Lighthouse's simulated LCP). Other routes may load an extra chunk.
    turbopackChunking: { priorityRoutes: [/^\/$/], minChunkSize: 120_000 },
  },
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_COMMIT_SHA: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7),
    NEXT_PUBLIC_ON_VERCEL: process.env.VERCEL ? "1" : "",
    NEXT_PUBLIC_LOG_POSTS: String(countVisiblePosts()),
  },
  async redirects() {
    // Recruiter Mode is a static route; the old query-string form lands there.
    return [
      {
        source: "/",
        has: [{ type: "query" as const, key: "mode", value: "recruiter" }],
        destination: "/recruiter",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        // Captures keep stable file names (pnpm media overwrites them), so cache for a day and revalidate in the background.
        source: "/media/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=2592000" }],
      },
    ];
  },
};

export default nextConfig;
