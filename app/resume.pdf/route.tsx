import { renderToBuffer } from "@react-pdf/renderer";
import { ResumeDocument } from "@/lib/resume/ResumeDocument";
import { RESUME_FILENAME, buildResumeModel } from "@/lib/resume/model";

// Rendered once at build time and served as a static file from the CDN.
export const dynamic = "force-static";

export async function GET() {
  const pdf = await renderToBuffer(<ResumeDocument model={buildResumeModel()} />);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // inline: opens in the browser's viewer; the filename is used when the visitor saves it.
      "Content-Disposition": `inline; filename="${RESUME_FILENAME}"`,
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
