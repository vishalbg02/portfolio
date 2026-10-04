import { VCARD_FILENAME, buildVCard } from "@/lib/contact/vcard";

// Built once at build time and served as a static file, like the résumé PDF.
export const dynamic = "force-static";

export function GET() {
  return new Response(buildVCard(), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      // inline, so a phone that scans the QR code offers "Add contact" instead of only saving a file
      "Content-Disposition": `inline; filename="${VCARD_FILENAME}"`,
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
