import type { Metadata } from "next";
import { profile } from "@/content/profile";
import { site } from "@/lib/site";

export const HOME_TITLE = `${profile.name} — ${profile.shortRole}`;

/** ~150 chars, facts only, leads with the name + role + city people actually search for. */
export const HOME_DESCRIPTION =
  "Vishal B G is a full-stack developer in Bengaluru (Java, Spring Boot, React, Next.js, SQL). Shipped Talnio and Golden Verdict. MCA at CHRIST University.";

export const baseMetadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: HOME_TITLE, template: `%s · ${profile.name}` },
  description: HOME_DESCRIPTION,
  applicationName: profile.name,
  authors: [{ name: profile.name, url: site.url }],
  creator: profile.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: profile.name,
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: "/",
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image", title: HOME_TITLE, description: HOME_DESCRIPTION },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  ...(site.gscVerification || site.bingVerification
    ? {
        verification: {
          ...(site.gscVerification ? { google: site.gscVerification } : {}),
          ...(site.bingVerification ? { other: { "msvalidate.01": site.bingVerification } } : {}),
        },
      }
    : {}),
};

/** Per-route metadata with canonical URL. */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: `/${string}`;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: `${title} · ${profile.name}`, description, url: path },
    twitter: { title: `${title} · ${profile.name}`, description },
  };
}
