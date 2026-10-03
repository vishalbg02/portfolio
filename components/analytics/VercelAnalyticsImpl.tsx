"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function VercelAnalyticsImpl() {
  return (
    <>
      <Analytics
        beforeSend={(event) => {
          const url = new URL(event.url);
          url.search = "";
          return { ...event, url: url.toString() };
        }}
      />
      <SpeedInsights />
    </>
  );
}
