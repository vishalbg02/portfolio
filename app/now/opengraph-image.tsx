import { OG_SIZE, OG_TYPE, renderOg } from "@/lib/seo/og";

export const alt = "Now — Vishal B G";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderOg({ title: "What I'm doing now", kicker: "Now", path: "/now" });
}
