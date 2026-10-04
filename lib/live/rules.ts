import { countLinks, MESSAGE_ERRORS, cleanText, oneLine } from "@/lib/notify/message";
import { LIVE } from "./types";

/** The live chat's field rules for the browser (no Zod, so the chat chunk stays small). The server uses ./schema.ts. */
export type LiveValues = { name: string; email: string; org: string; message: string };
export type LiveErrors = Partial<Record<keyof LiveValues, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateLive(
  v: LiveValues,
  opts: { needName: boolean; needEmail: boolean },
): { ok: true; data: LiveValues } | { ok: false; errors: LiveErrors } {
  const name = oneLine(v.name);
  const email = v.email.trim();
  const org = oneLine(v.org);
  const message = cleanText(v.message);
  const errors: LiveErrors = {};
  if (opts.needName) {
    if (name.length < LIVE.name.min) errors.name = MESSAGE_ERRORS.name;
    else if (name.length > LIVE.name.max) errors.name = MESSAGE_ERRORS.nameLong;
  }
  if (email ? !EMAIL.test(email) || email.length > LIVE.email.max : opts.needEmail)
    errors.email = MESSAGE_ERRORS.email;
  if (org.length > LIVE.org.max) errors.org = "Keep this under 120 characters.";
  if (message.length < LIVE.message.min) errors.message = "Write a message first.";
  else if (message.length > LIVE.message.max) errors.message = MESSAGE_ERRORS.messageLong;
  else if (countLinks(message) > LIVE.links) errors.message = MESSAGE_ERRORS.links;
  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, data: { name, email, org, message } };
}
