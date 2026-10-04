import { z } from "zod";
import { MESSAGE_ERRORS, cleanText, countLinks, oneLine } from "@/lib/notify/message";
import { LIVE } from "./types";

const path = z
  .string()
  .max(200)
  .regex(/^\/[A-Za-z0-9\-._~/#?=&%]*$/);

const text = z
  .string()
  .transform(cleanText)
  .pipe(
    z
      .string()
      .min(LIVE.message.min, "Write a message first.")
      .max(LIVE.message.max, MESSAGE_ERRORS.messageLong)
      .refine((m) => countLinks(m) <= LIVE.links, MESSAGE_ERRORS.links),
  );

const optionalEmail = z
  .union([z.literal(""), z.email(MESSAGE_ERRORS.email).max(LIVE.email.max)])
  .optional()
  .transform((v) => v || null);

/** POST /api/live/message. Without `c` and `k` it starts a conversation (then `name` is required). */
export const LiveMessageSchema = z.object({
  c: z.uuid().optional(),
  k: z.string().max(64).optional(),
  name: z
    .string()
    .transform(oneLine)
    .pipe(z.string().min(LIVE.name.min, MESSAGE_ERRORS.name).max(LIVE.name.max, MESSAGE_ERRORS.nameLong))
    .optional(),
  email: optionalEmail,
  org: z
    .string()
    .transform(oneLine)
    .pipe(z.string().max(LIVE.org.max))
    .optional()
    .transform((v) => v || null),
  message: text,
  page: path.optional(),
  /** Honeypot. */
  website: z.string().max(0).optional().default(""),
  /** The Turnstile token, when a site key is configured. */
  turnstile: z.string().max(2100).optional(),
});
export type LiveMessageInput = z.output<typeof LiveMessageSchema>;

export const LiveContactSchema = z.object({
  c: z.uuid(),
  k: z.string().max(64),
  email: z.email(MESSAGE_ERRORS.email).max(LIVE.email.max),
  org: z
    .string()
    .transform(oneLine)
    .pipe(z.string().max(LIVE.org.max))
    .optional()
    .transform((v) => v || null),
});
