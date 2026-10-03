import { ImageResponse } from "next/og";
import { PixelMark } from "@/lib/seo/pixel-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<PixelMark size={180} padding={14} />, size);
}
