import { profile } from "@/content/profile";
import { OG_SIZE, OG_TYPE, renderOg } from "@/lib/seo/og";

export const alt = `${profile.name} — Résumé`;
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderOg({ title: "Résumé", kicker: profile.shortRole, path: "/resume" });
}
