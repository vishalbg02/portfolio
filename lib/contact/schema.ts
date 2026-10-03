import { z } from "zod";
import { LIMITS, MESSAGES, type ContactErrors } from "./rules";

/** Authoritative server-side validation for /api/contact (built from the same LIMITS as the client). */
export const ContactSchema = z.object({
  name: z.string().trim().min(LIMITS.name.min, MESSAGES.nameMin).max(LIMITS.name.max, MESSAGES.nameMax),
  email: z.email(MESSAGES.email).max(LIMITS.email.max),
  org: z.string().trim().max(LIMITS.org.max, MESSAGES.org).optional().default(""),
  message: z
    .string()
    .trim()
    .min(LIMITS.message.min, MESSAGES.messageMin)
    .max(LIMITS.message.max, MESSAGES.messageMax),
  /** Honeypot: real people never see or fill this. */
  website: z.string().max(0).optional().default(""),
});

export type ContactInput = z.input<typeof ContactSchema>;
export type ContactData = z.output<typeof ContactSchema>;

export function fieldErrors(error: z.ZodError): ContactErrors {
  const out: ContactErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if ((key === "name" || key === "email" || key === "org" || key === "message") && !out[key])
      out[key] = issue.message;
  }
  return out;
}
