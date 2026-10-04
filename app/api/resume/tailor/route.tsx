import { renderToBuffer } from "@react-pdf/renderer";
import { z } from "zod";
import { json, sameOrigin } from "@/lib/http";
import { MAX_REQUIREMENTS, ImportanceSchema } from "@/lib/match/types";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { ResumeDocument } from "@/lib/resume/ResumeDocument";
import { buildResumeModel } from "@/lib/resume/model";
import { tailorResume } from "@/lib/resume/tailor";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  requirements: z
    .array(z.object({ skill: z.string().trim().min(1).max(60), importance: ImportanceSchema }))
    .min(1)
    .max(MAX_REQUIREMENTS + 1),
  role: z
    .string()
    .trim()
    .max(60)
    .regex(/^[A-Za-z0-9 +#.,&/()-]*$/)
    .optional(),
  /** "summary" answers with what would change (JSON); "pdf" (default) with the file. */
  format: z.enum(["pdf", "summary"]).optional().default("pdf"),
});

/**
 * Builds a one-page résumé re-ordered for a role. The request carries only the requirements (already extracted, from
 * the matcher), so this route calls no model: the selection is deterministic and writes no new text.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const raw = await req.text();
  if (raw.length > 4_000) return json({ error: "too_large" }, 413);
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = Body.safeParse(payload);
  if (!parsed.success) return json({ error: "invalid" }, 400);

  const limit = await rateLimit({ scope: "tailor", limit: 8, windowSec: 600 }, clientKey(req.headers));
  if (!limit.ok) return json({ error: "rate_limited" }, 429, { "Retry-After": String(limit.retryAfterSec) });

  const { requirements, role, format } = parsed.data;
  const tailored = tailorResume(buildResumeModel(), requirements, role ?? null);
  if (format === "summary") return json({ summary: tailored.summary, filename: tailored.filename });

  const pdf = await renderToBuffer(<ResumeDocument model={tailored.model} />);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${tailored.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
