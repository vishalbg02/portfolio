import { z } from "zod";
import { MESSAGE_ERRORS, MESSAGE_LIMITS, cleanText, countLinks, oneLine } from "./message";

/** Authoritative validation for POST /api/grid/message (the same limits as the card in the chat). */
export const GridMessageSchema = z.object({
  name: z
    .string()
    .transform(oneLine)
    .pipe(
      z
        .string()
        .min(MESSAGE_LIMITS.name.min, MESSAGE_ERRORS.name)
        .max(MESSAGE_LIMITS.name.max, MESSAGE_ERRORS.nameLong),
    ),
  email: z.email(MESSAGE_ERRORS.email).max(MESSAGE_LIMITS.email.max),
  message: z
    .string()
    .transform(cleanText)
    .pipe(
      z
        .string()
        .min(MESSAGE_LIMITS.message.min, MESSAGE_ERRORS.messageShort)
        .max(MESSAGE_LIMITS.message.max, MESSAGE_ERRORS.messageLong)
        .refine((m) => countLinks(m) <= MESSAGE_LIMITS.links, MESSAGE_ERRORS.links),
    ),
  /** Optional, from the card's Company and Role fields (pre-filled from what the visitor typed). */
  company: z
    .string()
    .transform(oneLine)
    .pipe(z.string().max(MESSAGE_LIMITS.company.max))
    .optional()
    .default(""),
  role: z.string().transform(oneLine).pipe(z.string().max(MESSAGE_LIMITS.role.max)).optional().default(""),
  /** One id per attempt, so a double click or a retry cannot deliver the same message twice. */
  requestId: z.uuid(),
  /** The page the visitor was on (a path), so the message has context. */
  page: z
    .string()
    .max(200)
    .regex(/^\/[A-Za-z0-9\-._~/#?=&%]*$/)
    .optional(),
  /** Honeypot: real people never see or fill this. */
  website: z.string().max(0).optional().default(""),
});
export type GridMessage = z.output<typeof GridMessageSchema>;
