/**
 * Contact-form rules WITHOUT Zod, so the client bundle stays small (Zod is ~90 KB gzipped).
 * The server validates with the Zod schema in ./schema.ts, built from the same LIMITS; a unit test
 * keeps the two in agreement.
 */
export const LIMITS = {
  name: { min: 2, max: 80 },
  email: { max: 200 },
  org: { max: 120 },
  message: { min: 10, max: 2000 },
} as const;

export const MESSAGES = {
  nameMin: "Please enter your name.",
  nameMax: "That name is too long.",
  email: "Please enter a valid email address.",
  org: "Keep this under 120 characters.",
  messageMin: "Tell me a little more (at least 10 characters).",
  messageMax: "Please keep it under 2,000 characters.",
} as const;

export type ContactField = "name" | "email" | "org" | "message";
export type ContactErrors = Partial<Record<ContactField, string>>;
export type ContactValues = { name: string; email: string; org?: string; message: string; website?: string };
export type ContactData = { name: string; email: string; org: string; message: string; website: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateContact(
  input: ContactValues,
): { ok: true; data: ContactData } | { ok: false; errors: ContactErrors } {
  const name = input.name.trim();
  const email = input.email.trim();
  const org = (input.org ?? "").trim();
  const message = input.message.trim();
  const website = input.website ?? "";
  const errors: ContactErrors = {};

  if (name.length < LIMITS.name.min) errors.name = MESSAGES.nameMin;
  else if (name.length > LIMITS.name.max) errors.name = MESSAGES.nameMax;
  if (!EMAIL.test(email) || email.length > LIMITS.email.max) errors.email = MESSAGES.email;
  if (org.length > LIMITS.org.max) errors.org = MESSAGES.org;
  if (message.length < LIMITS.message.min) errors.message = MESSAGES.messageMin;
  else if (message.length > LIMITS.message.max) errors.message = MESSAGES.messageMax;

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, data: { name, email, org, message, website } };
}

/** Strip CR/LF and control characters so user text can never inject mail headers. */
export const singleLine = (s: string) => s.replace(/[\r\n\u0000-\u001f\u007f]+/g, " ").trim();

export function mailtoHref(to: string, data: { name?: string; org?: string; message?: string }): string {
  const subject = `Hello Vishal — ${singleLine(data.name ?? "") || "portfolio message"}`;
  const lines = [
    data.message ?? "",
    "",
    data.name ? `— ${singleLine(data.name)}` : "",
    data.org ? singleLine(data.org) : "",
  ];
  const body = lines.join("\n").trim();
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
