import { OG_SIZE, OG_TYPE, renderOg } from "@/lib/seo/og";

export const alt = "Recruiter mode — Vishal B G";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderOg({ title: "Vishal B G at a glance", kicker: "Recruiter mode", path: "/recruiter" });
}
