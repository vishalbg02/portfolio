/**
 * The rules for a message to Vishal, WITHOUT Zod so the chat card (client) and the API route (server) share them and
 * the browser bundle stays small. The route validates with the Zod schema in ./schema.ts, built from the same limits;
 * a unit test keeps the two in agreement.
 */
export const MESSAGE_LIMITS = {
  name: { min: 2, max: 80 },
  email: { max: 200 },
  message: { min: 10, max: 1500 },
  /** More than this many links in one message is refused (a spam tell). */
  links: 2,
} as const;

export const MESSAGE_ERRORS = {
  name: "Please enter your name.",
  nameLong: "That name is too long.",
  email: "Please enter a valid email address.",
  messageShort: "Tell him a little more (at least 10 characters).",
  messageLong: "Please keep it under 1,500 characters.",
  links: "Please include at most two links.",
} as const;

export type MessageField = "name" | "email" | "message";
export type MessageErrors = Partial<Record<MessageField, string>>;
export type MessageValues = { name: string; email: string; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Web addresses: with a scheme or www., or a bare domain on a common ending (never the part of an email after "@"). */
const LINK =
  /(?:https?:\/\/|www\.)\S+|(?<![@\w.-])[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|dev|app|in|co|ai|xyz|me|link|ly|info|biz)\b(?:\/\S*)?/gi;
export const countLinks = (text: string) => (text.match(LINK) ?? []).length;

/** One line, no control characters (names and subjects). */
export const oneLine = (s: string) =>
  s
    .replace(/[\r\n\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Keeps line breaks, drops control characters and runs of blank lines. */
export const cleanText = (s: string) =>
  s
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export function validateMessage(
  input: MessageValues,
): { ok: true; data: MessageValues } | { ok: false; errors: MessageErrors } {
  const name = oneLine(input.name);
  const email = input.email.trim();
  const message = cleanText(input.message);
  const errors: MessageErrors = {};
  if (name.length < MESSAGE_LIMITS.name.min) errors.name = MESSAGE_ERRORS.name;
  else if (name.length > MESSAGE_LIMITS.name.max) errors.name = MESSAGE_ERRORS.nameLong;
  if (!EMAIL.test(email) || email.length > MESSAGE_LIMITS.email.max) errors.email = MESSAGE_ERRORS.email;
  if (message.length < MESSAGE_LIMITS.message.min) errors.message = MESSAGE_ERRORS.messageShort;
  else if (message.length > MESSAGE_LIMITS.message.max) errors.message = MESSAGE_ERRORS.messageLong;
  else if (countLinks(message) > MESSAGE_LIMITS.links) errors.message = MESSAGE_ERRORS.links;
  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, data: { name, email, message } };
}
