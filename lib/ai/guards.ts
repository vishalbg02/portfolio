import { z } from "zod";
import { ProjectSlugSchema, type ProjectSlug } from "@/lib/content/profile-schema";
import { inputLimit } from "./agent/jd";
import { LIMITS } from "./limits";
import { isLang, type Lang } from "./lang";
import { isMode, type GridMode } from "./modes";
import type { ChatMessage } from "./protocol";

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const clean = (s: string) => s.replace(CONTROL, "").replace(/\r\n?/g, "\n").trim();

const BodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .min(1)
    .max(60),
  /** "Ask about this project": retrieval puts this project's chunks first. */
  project: ProjectSlugSchema.optional(),
  /** GRID's mode (recruiter, engineer…): changes the prompt and the suggestions, nothing else. */
  mode: z.string().max(16).optional(),
  /** The reply language the visitor chose (en, kn, hi), or auto. */
  lang: z.string().max(16).optional(),
});

export type ChatValidation =
  | { ok: true; messages: ChatMessage[]; question: string; project?: ProjectSlug; mode: GridMode; lang: Lang }
  | { ok: false; error: string; status: number };

/**
 * Validates a chat request body. Only the last N messages are kept; the newest must be a user
 * message within the length cap; assistant history is truncated (it comes from the client).
 */
export function validateChatRequest(body: unknown): ChatValidation {
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: "invalid_request", status: 400 };

  const recent = parsed.data.messages.slice(-LIMITS.historyTurns).map<ChatMessage>((m) => ({
    role: m.role,
    content: clean(m.content),
  }));
  const last = recent[recent.length - 1]!;
  if (last.role !== "user") return { ok: false, error: "last_message_must_be_user", status: 400 };
  if (last.content.length === 0) return { ok: false, error: "empty_message", status: 400 };
  if (last.content.length > inputLimit(last.content))
    return { ok: false, error: "message_too_long", status: 400 };

  // history must start with a user turn and alternate sensibly for the model
  while (recent.length > 1 && recent[0]!.role !== "user") recent.shift();
  const messages = recent
    .filter((m) => m.content.length > 0)
    .map((m, i, all) =>
      m.role === "assistant" || i === all.length - 1
        ? {
            ...m,
            content: m.role === "assistant" ? m.content.slice(0, LIMITS.historyAssistantChars) : m.content,
          }
        : { ...m, content: m.content.slice(0, LIMITS.chatInputChars) },
    );
  const mode: GridMode = isMode(parsed.data.mode) ? parsed.data.mode : "default";
  const lang: Lang = isLang(parsed.data.lang) ? parsed.data.lang : "auto";
  return { ok: true, messages, question: last.content, project: parsed.data.project, mode, lang };
}

export const MatchBodySchema = z.object({ jd: z.string() });

export type MatchValidation = { ok: true; jd: string } | { ok: false; error: string; status: number };

export function validateMatchRequest(body: unknown): MatchValidation {
  const parsed = MatchBodySchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: "invalid_request", status: 400 };
  const jd = clean(parsed.data.jd);
  if (jd.length < 40) return { ok: false, error: "jd_too_short", status: 400 };
  if (jd.length > LIMITS.jdInputChars) return { ok: false, error: "jd_too_long", status: 400 };
  return { ok: true, jd };
}

/** Query used for retrieval: a very short follow-up ("and Talnio?") borrows the previous question. */
export function retrievalQuery(messages: ChatMessage[]): string {
  const users = messages.filter((m) => m.role === "user");
  const last = users[users.length - 1]!.content;
  const prev = users[users.length - 2]?.content;
  return last.split(/\s+/).length < 6 && prev ? `${prev} ${last}` : last;
}
