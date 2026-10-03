import { OG_SIZE, OG_TYPE, renderOg } from "@/lib/seo/og";

export const alt = "Ship Log — Vishal B G";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderOg({ title: "Ship Log", kicker: "Notes on building and shipping", path: "/log" });
}
