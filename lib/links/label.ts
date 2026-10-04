import { LINK } from "@/lib/live/types";

/**
 * A company or role label for a personal link. Only labels Vishal typed in Telegram are ever shown on the site, and they
 * are cleaned here first: letters, digits, spaces and a few punctuation marks, one space between words, a length cap.
 * Nothing from a URL is ever displayed.
 */
export function cleanLabel(raw: string, max: number): string {
  return raw
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} &.,'()+/#-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

/**
 * "/link Infosys SDE" → Infosys, SDE. For a longer company name separate the two with "|": "Tata Consultancy | Java
 * Developer". One word alone is the company.
 */
export function parseLinkArgs(arg: string): { company: string; role: string | null } | null {
  const text = arg.trim();
  if (!text) return null;
  let company: string;
  let role: string;
  const bar = text.indexOf("|");
  if (bar >= 0) {
    company = text.slice(0, bar);
    role = text.slice(bar + 1);
  } else {
    const [first = "", ...rest] = text.split(/\s+/);
    company = first;
    role = rest.join(" ");
  }
  const c = cleanLabel(company, LINK.company.max);
  if (!c || !/[\p{L}\p{N}]/u.test(c)) return null;
  const r = cleanLabel(role, LINK.role.max);
  return { company: c, role: r || null };
}
