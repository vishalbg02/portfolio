import { OG_SIZE, OG_TYPE, renderOg } from "@/lib/seo/og";

export const alt = "Work — Vishal B G";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderOg({ title: "Everything ships.", kicker: "Selected work", path: "/work" });
}
