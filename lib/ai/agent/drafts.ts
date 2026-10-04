import { profile } from "@/content/profile";
import { oneLine } from "@/lib/notify/message";
import { DRAFT_KINDS, type DraftKind, type UiPart } from "../protocol";

/**
 * Drafts for the VISITOR to send to Vishal (an interview invitation, an introduction, a project inquiry, a hackathon
 * team invitation). Written from fixed templates, not by the model: the model only picks the kind and fills what the
 * visitor told it. Anything unknown stays as a [bracketed placeholder] for the visitor to replace. The templates state
 * no fact about Vishal beyond his name.
 */
export type DraftContext = {
  senderName?: string;
  company?: string;
  role?: string;
  topic?: string;
  when?: string;
};

const first = profile.name.split(" ")[0]!;
const clean = (v: string | undefined) => (v ? oneLine(v).slice(0, 80) : "");
const or = (v: string | undefined, placeholder: string) => clean(v) || `[${placeholder}]`;

export function draftMessage(kind: DraftKind, ctx: DraftContext): { subject: string; body: string } {
  const me = or(ctx.senderName, "your name");
  const company = clean(ctx.company);
  const topic = clean(ctx.topic);
  switch (kind) {
    case "interview_invite": {
      const role = or(ctx.role, "role");
      const org = or(ctx.company, "company");
      return {
        subject: `Interview invitation: ${role} at ${org}`,
        body: [
          `Hi ${first},`,
          "",
          `I'm ${me} from ${org}. We'd like to invite you to interview for our ${role} role.`,
          "",
          `Would you be free ${or(ctx.when, "a day and time")}? If not, please reply with a few times that suit you and I'll arrange the rest.`,
          "",
          "Thanks,",
          me,
        ].join("\n"),
      };
    }
    case "intro":
      return {
        subject: `Hello from ${clean(ctx.senderName) || "a visitor"}`,
        body: [
          `Hi ${first},`,
          "",
          `I'm ${me}${company ? ` at ${company}` : ""}. I came across your portfolio and wanted to get in touch${topic ? ` about ${topic}` : ""}.`,
          "",
          topic ? "[One line on what you have in mind.]" : "[What would you like to talk about?]",
          "",
          "Thanks,",
          me,
        ].join("\n"),
      };
    case "project_inquiry":
      return {
        subject: `Project inquiry: ${or(ctx.topic, "what you need")}`,
        body: [
          `Hi ${first},`,
          "",
          `I'm ${me}${company ? ` at ${company}` : ""}. I'm looking for help with ${or(ctx.topic, "what you need")}.`,
          "",
          "[A line or two on the scope, and when you'd like to start.]",
          "",
          "Could we find a time to talk?",
          "",
          "Thanks,",
          me,
        ].join("\n"),
      };
    case "hackathon_team":
      return {
        subject: `Hackathon teammate: ${or(ctx.topic, "event")}`,
        body: [
          `Hi ${first},`,
          "",
          `I'm ${me}. We're putting together a team for ${or(ctx.topic, "the hackathon")} and would love to have you on it.`,
          "",
          "[Date, format, and what you are building.]",
          "",
          "Would you be interested?",
          "",
          "Thanks,",
          me,
        ].join("\n"),
      };
  }
}

export function draftPart(kind: DraftKind, ctx: DraftContext = {}): UiPart {
  const { subject, body } = draftMessage(kind, ctx);
  return { kind: "draft", draftKind: kind, subject, body, mailto: profile.contact.email };
}

export const isDraftKind = (v: unknown): v is DraftKind =>
  (DRAFT_KINDS as readonly string[]).includes(v as string);
