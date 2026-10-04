/**
 * pnpm email:preview            → writes .email-preview/owner.html and visitor.html (open them in a browser)
 * pnpm email:preview --send     → also sends both to CONTACT_TO_EMAIL through Resend (needs RESEND_API_KEY)
 * Sample content only. The real emails are built by app/api/contact/route.ts from lib/email/templates.ts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Resend } from "resend";
import { ownerEmail, visitorEmail } from "@/lib/email/templates";

const sample = {
  name: "Priya Sharma",
  email: "priya@example.com",
  org: "Acme Labs",
  message:
    "Hi Vishal,\n\nWe saw the Talnio case study and have an SDE opening on our platform team (Java / Spring Boot).\nAre you free for a quick call this week?\n\nThanks,\nPriya",
};
const owner = ownerEmail(sample);
const visitor = visitorEmail(sample);
mkdirSync(".email-preview", { recursive: true });
writeFileSync(".email-preview/owner.html", owner.html);
writeFileSync(".email-preview/visitor.html", visitor.html);
console.log("✓ .email-preview/owner.html and visitor.html");

if (process.argv.includes("--send")) {
  const to = process.env.CONTACT_TO_EMAIL;
  if (!process.env.RESEND_API_KEY || !to) {
    console.error("--send needs RESEND_API_KEY and CONTACT_TO_EMAIL");
    process.exit(1);
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  for (const [tag, mail] of [
    ["owner", owner],
    ["visitor", visitor],
  ] as const) {
    const { error } = await resend.emails.send({
      from: "Portfolio contact <onboarding@resend.dev>",
      to,
      subject: `[preview: ${tag}] ${mail.subject}`,
      html: mail.html,
      text: mail.text,
    });
    console.log(error ? `✕ ${tag}: ${error.message}` : `✓ sent ${tag} preview to ${to}`);
  }
}
