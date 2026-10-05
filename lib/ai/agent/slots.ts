import "@/lib/content/zod-csp";
import { z } from "zod";

/**
 * Who is writing, from what the visitor typed: "I'm Priya from Acme, priya@acme.dev — tell Vishal we'd like to
 * interview him for a backend role" → name Priya, email, company Acme, role backend. Used to pre-fill the message card
 * (router and model alike), where the visitor can still change every field and nothing is sent until they press Send.
 *
 * Deterministic and conservative: patterns are tried in order, a value is kept only when it passes SlotsSchema, and
 * anything unclear stays empty for the visitor to fill in.
 */
export const SlotsSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.email().max(200).optional(),
  company: z.string().trim().min(2).max(80).optional(),
  role: z.string().trim().min(2).max(80).optional(),
});
export type Slots = z.infer<typeof SlotsSchema>;

/** A capitalised word ("Priya", "O'Neil", "Rao-Shah"), a run of them, or a company that may contain "&". */
const W = "[A-Z][A-Za-z'’-]+";
const PERSON = `${W}(?: ${W}){0,2}`;
/** A word may contain an inner dot ("Node.js", "Inc.Co") but never end on one: "Infosys. We're" stops at "Infosys". */
const ORG_WORD = "[A-Z][\\w&'’-]*(?:\\.[A-Za-z]+)*";
const ORG = `${ORG_WORD}(?: (?:${ORG_WORD}|&)){0,3}`;
/** A job title word: never a pronoun or a little linking word ("hiring him for the SDE role" → "SDE"). */
const TITLE_WORD =
  "(?!(?:him|her|them|vishal|for|to|with|the|a|an|our|his)\\b)[A-Za-z][\\w/+#-]*(?:\\.[A-Za-z]+)*";
const TITLE = `${TITLE_WORD}(?: ${TITLE_WORD}){0,3}?`;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;

const NAMES = [
  new RegExp(`\\b[Nn]ame:\\s*(${PERSON})`, "g"),
  new RegExp(`\\b(?:[Ii]'?m|I am|[Mm]y name is|[Tt]his is|[Ii]t'?s)\\s+(${PERSON})`, "g"),
  // "a note from Meera at Freshworks": the person comes before the company
  new RegExp(`\\bfrom\\s+(${PERSON})\\s+(?:at|of)\\s+[A-Z]`, "g"),
];
/** Capitalised words that follow "I'm" without being a name. */
const NOT_NAME =
  /^(?:A|An|The|Hiring|Looking|Interested|From|With|At|Writing|Reaching|Here|Recruiting|Currently|Working|Just|So|Very|Really|Happy|Glad|Sure|Not|Also|Vishal|Hi|Hello|Hey|HR|Recruiter)\b/;

const COMPANIES = [
  new RegExp(`\\b[Cc]ompany:\\s*(${ORG})`, "g"),
  new RegExp(`\\b(?:at|work for|working for|work at|working at|with|of)\\s+(${ORG})`, "g"),
  new RegExp(`\\bfrom\\s+(${ORG})(?!\\s+(?:at|of)\\s+[A-Z])`, "g"),
];
const NOT_COMPANY =
  /^(?:Vishal|Him|You|Us|Me|My|Our|Your|The|A|An|This|That|Talnio|Golden Verdict|LanSymphony|GRID|Spring Boot|Java|React)\b/;

const ROLES = [
  /\b[Rr]ole:\s*([^,.;\n]{2,60})/g,
  new RegExp(
    `\\b(?:hiring|for|about|discuss|re|regarding)\\s+(?:a |an |the |our |his )?(${TITLE})\\s+(?:role|position|opening|job)\\b`,
    "gi",
  ),
  /\bhiring (?:a |an )?([A-Z][\w/+#-]*(?: [A-Z][\w/+#-]*){0,3})/g,
  /\b(?:a|an|the)\s+((?:[A-Z][\w/+#-]*\s+){0,3}(?:Engineer|Developer|Intern|Architect|Lead|Manager|Designer|Analyst))\b/g,
];
const NOT_ROLE = /^(?:him|you|vishal|me|us|it|this|that|chat|call|interview|meeting|quick|short|new)$/i;

const tidy = (s: string | undefined) =>
  s
    ?.replace(/\s+/g, " ")
    .replace(/[\s,.;:—–-]+$/, "")
    .trim() || undefined;

function first(patterns: RegExp[], text: string, ok: (v: string) => boolean): string | undefined {
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const v = tidy(m[1]);
      if (v && ok(v)) return v;
    }
  }
  return undefined;
}

export function extractSlots(text: string): Slots {
  const t = text.slice(0, 1500);
  const email = EMAIL.exec(t)?.[0];
  const name = first(NAMES, t, (v) => !NOT_NAME.test(v));
  const company = first(
    COMPANIES,
    t,
    (v) =>
      !NOT_COMPANY.test(v) &&
      v.toLowerCase() !== name?.toLowerCase() &&
      !name?.toLowerCase().startsWith(v.toLowerCase()),
  );
  const role = first(ROLES, t, (v) => !NOT_ROLE.test(v) && v.toLowerCase() !== company?.toLowerCase());

  // keep each field that is valid on its own
  const out: Slots = {};
  const raw = { name, email, company, role };
  for (const key of ["name", "email", "company", "role"] as const) {
    const one = SlotsSchema.shape[key].safeParse(raw[key]);
    if (one.success && one.data !== undefined) out[key] = one.data;
  }
  return out;
}
