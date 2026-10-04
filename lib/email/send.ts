import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";
import type { Conv } from "@/lib/live/types";
import { threadLink, unsubscribeLink } from "@/lib/live/token";
import { ownerEmail, replyEmail, type Submission } from "./templates";

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

/** Emails Vishal's reply to a visitor who left the chat. Needs a sender on a verified domain (see canAutoReply). */
export async function sendReplyEmail(conv: Conv, text: string): Promise<void> {
  if (!conv.email) throw new Error("no email address");
  const links = { thread: threadLink(conv.id), unsubscribe: unsubscribeLink(conv.id) };
  const mail = replyEmail(conv, text, links);
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM,
    to: conv.email,
    replyTo: env.CONTACT_TO_EMAIL!,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    headers: {
      "List-Unsubscribe": `<${links.unsubscribe}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
  if (error) throw new Error(error.message);
}
