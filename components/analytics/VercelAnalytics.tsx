"use client";

import dynamic from "next/dynamic";

const Impl = dynamic(() => import("./VercelAnalyticsImpl"), { ssr: false });

/**
 * Privacy-friendly analytics (no cookies, no consent banner needed). Mounted only on Vercel
 * builds — elsewhere the /_vercel/* scripts don't exist and would 404 in the console — and loaded
 * as a separate chunk after hydration, so it never counts toward the initial bundle.
 * The impl strips query strings so campaign tokens or ?mode= params never reach analytics.
 */
export function VercelAnalytics() {
  return process.env.NEXT_PUBLIC_ON_VERCEL ? <Impl /> : null;
}
