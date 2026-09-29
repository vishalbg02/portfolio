import type { Metadata } from "next";
import { profile } from "@/content/profile";
import { site } from "@/lib/site";

export const HOME_TITLE = `${profile.name} — ${profile.shortRole}`;

export const baseMetadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: HOME_TITLE, template: `%s · ${profile.name}` },
  description: profile.headline,
  applicationName: profile.name,
  authors: [{ name: profile.name, url: site.url }],
  creator: profile.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: profile.name,
    title: HOME_TITLE,
    description: profile.headline,
    url: "/",
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image", title: HOME_TITLE, description: profile.headline },
  robots: { index: true, follow: true },
  ...(site.gscVerification ? { verification: { google: site.gscVerification } } : {}),
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
