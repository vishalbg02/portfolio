import { ImageResponse } from "next/og";
import { PixelMark } from "@/lib/seo/pixel-mark";

/** Installable-app icons: /pwa-icon/192, /pwa-icon/512 and /pwa-icon/maskable (safe-zone padding). */
const SIZES = {
  "192": { px: 192, pad: 0 },
  "512": { px: 512, pad: 0 },
  maskable: { px: 512, pad: 80 },
} as const;

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const spec = SIZES[size as keyof typeof SIZES];
  if (!spec) return new Response("Not found", { status: 404 });
  return new ImageResponse(<PixelMark size={spec.px} padding={spec.pad} />, {
    width: spec.px,
    height: spec.px,
  });
}
