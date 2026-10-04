import { profile } from "@/content/profile";
import { resumeConfig } from "@/content/resume";
import type { ProjectSlug } from "@/lib/content/profile-schema";
import { runMatch } from "@/lib/match/run";
import { getStatuses } from "@/lib/status/cache";
import { BRIEF_PROMPT, type GridMode } from "../modes";
import type { Source, ToolName, UiPart } from "../protocol";
import {
  bookPart,
  confirmPart,
  livePart,
  contactCard,
  demoPart,
  diagramPart,
  matchSkill,
  navigatePart,
  projectCard,
  skillEvidence,
  statsPart,
  type ContactKind,
} from "./cards";
import { looksLikeJobDescription, norm } from "./jd";
import { draftPart, type DraftContext } from "./drafts";
import { findInterviewNote, interviewCard } from "./interview";
import { currentPresence } from "@/lib/live/read";
import { cleanRole, requirementsFor, resumeCard } from "./resume";
import { SourceRegistry } from "./sources";

export { looksLikeJobDescription, norm };

/**
 * The deterministic router: obvious commands ("show me Talnio", "take me to contact", "how do I reach him",
 * "brief me", a pasted job description) are answered here with NO model call, from content. That keeps the
 * common requests instant and free, works with no API key, and leaves the model for open questions.
 * Anything it is not sure about returns null and goes to the model with the same tools.
 */
export type Routed = {
  /** The cards to render, each with the tool it stands for (for analytics and the tool pills). */
  parts: Array<{ tool: ToolName; part: UiPart }>;
  text: string;
  sources: Source[];
};

const PROJECTS: Array<[ProjectSlug, RegExp]> = [
  ["golden-verdict", /\bgolden ?verdict\b|\bgv\b/],
  ["talnio", /\btalnio\b/],
  ["lansymphony", /\blan ?symphony\b/],
  ["virtual-tour", /\bvirtual tour\b|\bcampus tour\b|\bvr tour\b|\bchrist (university )?(vr|virtual)\b/],
];
export const findProject = (q: string): ProjectSlug | null =>
  PROJECTS.find(([, re]) => re.test(q))?.[0] ?? null;

const SECTIONS: Array<[string, RegExp]> = [
  ["work", /^(work|projects?|portfolio|selected work|work section|projects section)$/],
  ["experience", /^(experience|jobs?|career|work history|employment|internships?)$/],
  ["stack", /^(stack|skills?|tech( stack)?|technolog(y|ies)|tools)$/],
  ["activity", /^(activity|github( activity)?|commits?|contributions?|calendar|contribution calendar)$/],
  ["contact", /^(contact|contact form|get in touch)$/],
  ["resume", /^(resume|cv|resume page)$/],
  ["recruiter", /^(recruiter( mode| page)?|hiring page)$/],
  ["now", /^(now|now page)$/],
  ["privacy", /^(privacy|privacy policy|privacy page)$/],
  ["ask", /^(ask|ask grid|grid)$/],
  ["home", /^(home|top|homepage|home page|landing|start)$/],
];

const GO_VERBS =
  /^(?:please )?(?:(?:can|could|would) you )?(?:go to|take me to|bring me to|navigate to|jump to|scroll to|head to|open|show me|show|view|see|display|pull up|bring up|let me see)\s+(.+)$/;

const clean = (s: string) =>
  s
    .replace(/^(?:the|his|vishal s|vishal's|a|me|up|out)\s+/g, "")
    .replace(/^(?:the|his|vishal s|vishal's)\s+/g, "")
    .replace(/\s+(?:section|page|please|now|for me)$/g, "")
    .trim();

const link = (reg: SourceRegistry, id: string, title: string, url: string) =>
  `[${reg.addLink(id, title, url)}]`;

/* ── briefing ────────────────────────────────────────────────────────────────────────────────────── */

/** "A, B and C". */
const sentenceList = (items: string[]) =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

export function briefing(): Routed {
  const reg = new SourceRegistry();
  const c = {
    about: link(reg, "about", `About ${profile.name}`, "/"),
    status: link(reg, "status", "Availability", "/recruiter"),
    work: link(reg, "work", "Selected work", "/#work"),
    exp: link(reg, "employers", "Experience", "/#experience"),
    awards: link(reg, "recognition", "Recognition", "/#github"),
    edu: link(reg, "education", "Education", "/#experience"),
  };
  const jobs = profile.experience
    .map((e) => `${e.role}, ${e.company.split(",")[0]!.replace(/\s*\(.*$/, "")} (${e.period})`)
    .join("; ");
  const edu = profile.education.map(
    (e) => `${e.degree.replace(/\s*\(.*$/, "")}, ${e.period}${e.note ? ` — ${e.note}` : ""}`,
  );
  const live = profile.projects.filter((p) => p.live || p.store).map((p) => p.name);
  const more = profile.projects.length - live.length;
  const text = [
    `- **${profile.name}**, a ${profile.shortRole.toLowerCase()} in ${profile.location.split(",")[0]}: ${profile.targetRole.coreSkills.slice(0, 4).join(", ")}. ${c.about}`,
    `- ${profile.status}. ${profile.workPreferences.startDate}. ${c.status}`,
    `- Shipped: ${sentenceList(live)} (live)${more > 0 ? `, plus ${more} more ${more === 1 ? "project" : "projects"}` : ""}. ${c.work}`,
    `- Experience: ${jobs}. ${c.exp}`,
    `- Recognition: ${profile.recognition.length} hackathon podium ${profile.recognition.length === 1 ? "finish" : "finishes"}. ${c.awards}`,
    `- Education: ${edu.join("; ")}. ${c.edu}`,
  ].join("\n");
  return { parts: [], text, sources: reg.all() };
}

/* ── intents ─────────────────────────────────────────────────────────────────────────────────────── */

const BRIEF =
  /^(brief me|give me (a )?(quick |short )?(brief|summary|overview|rundown)|(a )?(quick|short) (brief|summary|overview)|in 30 seconds|30 seconds?|tl ?dr|summari[sz]e (him|vishal|this site))\b/;
const IDENTITY =
  /^(?:who|what) are you\b|^are you (?:vishal|him|real|a bot|an ai|human|a person|chatgpt)\b|^(?:who|what) is grid\b|\bwhat can you do\b|^(?:help|what do you do)$/;
const STATS =
  /\b(lighthouse|performance score|site stats|web vitals|core web vitals|uptime|last deploy|latest deploy|when was (this|the) (site )?deployed|is (the )?(site|it|everything) (up|live|online|working)|how fast is (this|the) site|status of (his|the) (products|projects|sites))\b/;
const CONTACT_Q =
  /^(?:(?:how|where) (?:do|can|could|should) (?:i|we) (?:contact|reach|hire|email|call|message|get in touch with)|(?:what(?:'s|s| is) )?(?:his|vishal s|vishal's)? ?(?:contact|email|e mail|phone|number|whatsapp|linkedin|github)(?: (?:details|info|address|number|id|profile))?|(?:give|show|share|send) me (?:his )?(?:contact|email|e mail|phone|number|whatsapp|linkedin|github)(?: (?:details|info|address|number|id|profile))?|contact (?:him|vishal)|reach (?:him|vishal)|get in touch)\b/;
/** "Is he available, and how do I reach him?": the how-to-reach part may come after something else. */
const CONTACT_ANYWHERE =
  /\b(?:how|where) (?:do|can|could|should) (?:i|we) (?:contact|reach|hire|email|call|message|get in touch with)\b/;
const DIAGRAM = /\b(architecture|diagram|system design|data flow|flow chart)\b/;
const DEMO = /\b(demo|walkthrough|walk through|walkthru|story)\b/;
const SHOW = /\b(show|play|run|start|watch|open|see|view|display|launch)\b/;

const contactKind = (q: string): ContactKind =>
  /\bwhatsapp\b/.test(q)
    ? "whatsapp"
    : /\blinkedin\b/.test(q)
      ? "linkedin"
      : /\bgithub\b/.test(q)
        ? "github"
        : /\b(e mail|email|mail)\b/.test(q)
          ? "email"
          : /\b(phone|number|call)\b/.test(q)
            ? "phone"
            : "all";

/* ── actions ─────────────────────────────────────────────────────────────────────────────────────── */

const BOOK =
  /\b(?:book|schedule|set up|arrange|fix|plan)\b.{0,30}\b(?:call|meeting|chat|slot|session|catch ?up|interview)\b|\b15 ?(?:min|minutes?)\b.{0,20}\b(?:call|chat|meeting)\b/;
const DRAFT =
  /\b(?:draft|write|compose|prepare|help me (?:write|draft))\b.{0,40}\b(?:invite|invitation|intro|introduction|message|email|note|inquiry|enquiry|hackathon)\b|\bsend (?:him|vishal) an? (?:invite|invitation)\b/;
const MESSAGE =
  /\b(?:send|leave|drop|pass|forward)\b.{0,25}\b(?:message|note|msg|question)\b.{0,25}\b(?:vishal|him)\b|\b(?:message|text|dm|ping)\b (?:vishal|him)\b|\bsend (?:vishal|him) (?:a |an |this |the )?(?:message|note|question)\b|\bi (?:want|would like|d like|wanna) to (?:message|write to|reach out to|talk to|speak to|chat with) (?:vishal|him)\b|\btell (?:vishal|him)\b/;
const LIVE_CHAT =
  /\b(?:live chat|chat live|chat with (?:him|vishal)|talk (?:to|with) (?:him|vishal) (?:live|now|directly)|speak (?:to|with) (?:him|vishal)|is (?:he|vishal) (?:online|around|available now))\b/;
const TAILOR =
  /\b(?:tailor|customi[sz]e|adapt|re-?order|re-?arrange|optimi[sz]e|personali[sz]e)\b.{0,40}\b(?:resume|cv)\b|\b(?:resume|cv)\b.{0,30}\btailored\b/;

const draftKindOf = (q: string) =>
  /\b(?:interview|invite|invitation)\b/.test(q)
    ? ("interview_invite" as const)
    : /\bhackathon|team ?mate|teammate\b/.test(q)
      ? ("hackathon_team" as const)
      : /\binquiry|enquiry|project|hire|work with\b/.test(q)
        ? ("project_inquiry" as const)
        : ("intro" as const);

/** "for the Backend Engineer role at Infosys" → { role, company } (from the original text, so capitals survive). */
function draftContext(text: string): DraftContext {
  const role = /\bfor (?:the |a |an )?(.+?)(?: role| position| job)?(?= at |[,.?!]|$)/i.exec(text)?.[1];
  const company = /\bat ((?:[A-Z][\w&.-]*)(?: [A-Z][\w&.-]*){0,3})/.exec(text)?.[1];
  return {
    role: role && role.length <= 60 && !/^(?:me|him|vishal|us)$/i.test(role) ? role : undefined,
    company,
  };
}

/** The message after "saying" / "that" / a colon, for "send him a message saying …". */
const messageBody = (text: string) => {
  const m =
    /(?:\bsaying\b|\bthat says\b|\bwith the message\b|\btell (?:him|vishal)(?: that)?\b)\s*:?\s*([\s\S]+)$|:\s*([\s\S]+)$/i.exec(
      text,
    );
  return (m?.[1] ?? m?.[2] ?? "").trim();
};

async function routeAction(text: string, q: string, mode?: GridMode): Promise<Routed | null> {
  const lead = q.slice(0, 140);

  if (mode === "interview") {
    const hit = findInterviewNote(text);
    if (hit) {
      const part = interviewCard(text);
      return {
        parts: [{ tool: "interview_answer", part }],
        text: hit.entry.answer
          ? "In his own words, from his interview notes."
          : "He hasn't written an answer to that yet, so I won't make one up. I can send him the question.",
        sources: [],
      };
    }
  }

  if (LIVE_CHAT.test(lead)) {
    const presence = await currentPresence();
    const part = livePart(presence);
    return {
      parts: [{ tool: "start_live_chat", part }],
      text:
        part.kind === "live" && part.state === "online"
          ? "He's online right now. You can message him from here."
          : part.kind === "live" && part.state === "away"
            ? "He's away at the moment, but you can leave a message and he'll reply by email."
            : "Live chat isn't switched on right now, but you can leave a message and he'll reply by email.",
      sources: [],
    };
  }

  if (BOOK.test(lead)) {
    const part = bookPart();
    return {
      parts: [{ tool: "book_call", part }],
      text:
        part.kind === "book" && part.calLink
          ? "You can book a call with him below."
          : "Booking isn't set up yet, but you can leave a message and he'll reply with times.",
      sources: [],
    };
  }

  if (DRAFT.test(lead)) {
    const part = draftPart(draftKindOf(lead), draftContext(text));
    return {
      parts: [{ tool: "draft_message", part }],
      text: "Here's a draft to edit. Anything in [brackets] is for you to fill in; you can copy it or send it to him from here.",
      sources: [],
    };
  }

  if (MESSAGE.test(lead)) {
    const part = confirmPart({ message: messageBody(text) });
    return {
      parts: [{ tool: "send_message_to_vishal", part }],
      text: "Here's your message to him for review. Nothing is sent until you press Send.",
      sources: [],
    };
  }

  if (TAILOR.test(lead)) {
    const focus = /\bfor\s+(?:the |a |an |this |my )?(.+)$/i.exec(text)?.[1]?.trim();
    const requirements = await requirementsFor({ focus });
    if (requirements.length === 0)
      return {
        parts: [],
        text: "Tell me the role or the key skills (or paste the job description) and I'll re-order his résumé for it.",
        sources: [],
      };
    const part = resumeCard(requirements, cleanRole(focus));
    return {
      parts: [{ tool: "tailor_resume", part }],
      text: "Here's his résumé re-ordered for that. It only moves what he already wrote, and the gaps are listed, not hidden.",
      sources: [],
    };
  }

  return null;
}

/* ── the router ──────────────────────────────────────────────────────────────────────────────────── */

export async function routeIntent(raw: string, opts: { mode?: GridMode } = {}): Promise<Routed | null> {
  const text = raw.trim();
  if (!text) return null;

  // A pasted job posting: match it (the model, if available, only extracts the requirements).
  if (looksLikeJobDescription(text)) {
    const result = await runMatch(text);
    const reg = new SourceRegistry();
    const n = reg.addLink("resume", "Résumé", "/resume");
    return {
      parts: [{ tool: "match_job", part: { kind: "match", result } }],
      text: `${result.summary} Gaps are shown as gaps. [${n}]`,
      sources: reg.all(),
    };
  }

  const q = norm(text);

  // Actions (book a call, draft, message him, tailor the résumé, interview notes) are recognised from how the request
  // starts, so they work even with a long message after them.
  const action = await routeAction(text, q, opts.mode);
  if (action) return action;

  if (q.length > 160) return null; // commands are short; anything long is a real question

  if (q === norm(BRIEF_PROMPT) || BRIEF.test(q)) return briefing();

  if (IDENTITY.test(q))
    return {
      parts: [],
      text: `I'm GRID, ${profile.name}'s AI. I'm not him: I only know what is on this site, and I say so when I don't know something. I can answer questions about his work, experience and skills with sources, show a project, its architecture or a walkthrough, show where he used a skill, match a job description against his profile, and take you to any part of the site.`,
      sources: [],
    };

  if (STATS.test(q)) {
    const reg = new SourceRegistry();
    const n = reg.addLink("site", "How this site is built", "/#github");
    return {
      parts: [{ tool: "get_site_stats", part: await statsPart(await getStatuses().catch(() => [])) }],
      text: `Real numbers: the Lighthouse scores are written by CI against production, and the status is a live probe. [${n}]`,
      sources: reg.all(),
    };
  }

  const project = findProject(q);

  if (project && DIAGRAM.test(q) && !/\bwhy\b/.test(q)) {
    const part = diagramPart(project)!;
    const reg = new SourceRegistry();
    const n = reg.addLink(
      `case-${project}-architecture`,
      `${part.kind === "diagram" ? part.name : project} — Architecture`,
      `/work/${project}#architecture`,
    );
    return {
      parts: [{ tool: "show_diagram", part }],
      text: `Here is the architecture. Press Run request to watch a request travel through it. [${n}]`,
      sources: reg.all(),
    };
  }

  if (project && DEMO.test(q) && SHOW.test(q)) {
    const part = demoPart(project)!;
    return {
      parts: [{ tool: "play_demo", part }],
      text: part.kind === "demo" ? `Opening ${part.name} on the Work stage.` : "",
      sources: [],
    };
  }

  if (CONTACT_Q.test(q) || (CONTACT_ANYWHERE.test(q) && q.split(" ").length <= 14)) {
    const kind = contactKind(q);
    const reg = new SourceRegistry();
    const n = reg.addLink("contact", "How to contact Vishal", "/#contact");
    const email = profile.contact.email;
    return {
      parts: [{ tool: "get_contact", part: contactCard(kind) }],
      text:
        kind === "all" || kind === "email"
          ? `${/\bavailab/.test(q) ? `${profile.status}. ` : ""}You can email ${profile.name} at ${email} or use the options below. [${n}]`
          : `Here ${kind === "phone" ? "is his phone number" : `is ${kind}`}. [${n}]`,
      sources: reg.all(),
    };
  }

  // "where did he use X", "evidence for X", "show his X work"
  const skillAsk =
    /\bwhere (?:did|has|does) (?:he|vishal) use(?:d)?\s+(.+)$/.exec(q)?.[1] ??
    /\b(?:evidence|proof) (?:of|for)\s+(.+)$/.exec(q)?.[1] ??
    /\bshow (?:me )?(?:his )?(.+?) (?:experience|work|projects|usage)$/.exec(q)?.[1] ??
    /\bhow (?:much|well) does (?:he|vishal) know\s+(.+)$/.exec(q)?.[1];
  if (skillAsk) {
    const skill = matchSkill(
      skillAsk.replace(/^(?:the|any|some)\s+/, "").replace(/\s+(?:before|anywhere|at all)$/, ""),
    );
    if (skill) {
      const part = skillEvidence(skill);
      const reg = new SourceRegistry();
      const n = reg.addLink("strengths", "Skills", "/#stack");
      return {
        parts: [{ tool: "show_skill_evidence", part }],
        text:
          part.kind === "skill" && part.found
            ? `${skill} shows up in ${part.where.length} place${part.where.length === 1 ? "" : "s"} on this site. [${n}]`
            : `${skill} isn't covered on this site.`,
        sources: reg.all(),
      };
    }
  }

  // "show me Talnio", "open golden verdict", or just the name
  const go = GO_VERBS.exec(q);
  if (project && (go ? clean(go[1]!).split(" ").length <= 6 : q.split(" ").length <= 3) && !DEMO.test(q)) {
    const part = projectCard(project)!;
    const reg = new SourceRegistry();
    const n = reg.addLink(
      `project-${project}`,
      `${part.kind === "project" ? part.name : project} — case study`,
      `/work/${project}`,
    );
    return {
      parts: [{ tool: "show_project", part }],
      text: part.kind === "project" ? `Here is ${part.name}: ${part.tagline}. [${n}]` : "",
      sources: reg.all(),
    };
  }

  // "go to contact", "take me to his résumé", "scroll to the work section"
  if (go) {
    const what = clean(go[1]!);
    const hit = SECTIONS.find(([, re]) => re.test(what));
    if (hit) {
      const part = navigatePart(hit[0]);
      if (part && part.kind === "navigate")
        return { parts: [{ tool: "navigate", part }], text: `Taking you to ${part.label}.`, sources: [] };
    }
  }

  // an unambiguous request for the résumé file
  if (/^(?:download|get|send me|give me|i want|i need)(?: me)? (?:his |a |the )?(?:resume|cv)\b/.test(q)) {
    const part = navigatePart("resume")!;
    return {
      parts: [{ tool: "navigate", part }],
      text: `His résumé is on this page (updated ${resumeConfig.updatedAt}); the PDF download is there too.`,
      sources: [],
    };
  }

  return null;
}
