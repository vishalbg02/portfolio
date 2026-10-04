import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { ownerEmail, type Submission } from "./templates";

// Resend's shared sender works without a verified domain (mail goes to the account owner).
// Switch to a verified domain later by setting CONTACT_FROM_EMAIL (see README).
export const FROM = process.env.CONTACT_FROM_EMAIL || "Portfolio contact <onboarding@resend.dev>";

/** Emails a visitor's message to Vishal (reply-to is the visitor). Throws if Resend refuses it. */
export async function sendOwnerEmail(sub: Submission, source?: string): Promise<void> {
  const resend = new Resend(env.RESEND_API_KEY);
  const mail = ownerEmail(sub, new Date(), source);
  const { error } = await resend.emails.send({
    from: FROM,
    to: env.CONTACT_TO_EMAIL!,
    replyTo: sub.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
  if (error) throw new Error(error.message);
}
