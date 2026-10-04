import { profile } from "@/content/profile";
import { workStatus } from "@/lib/content/work-status";
import { RESUME_FILENAME } from "@/lib/resume/model";
import { resumeHref, shipped } from "@/lib/site";

/**
 * Terminal brain: pure functions from a command line to output lines plus an optional UI action.
 * Everything it prints comes from profile.ts, so the terminal can never disagree with the site.
 */
export type Line = { text: string; tone?: "accent" | "muted" | "error"; href?: string };
export type TerminalAction =
  | { type: "navigate"; href: string }
  | { type: "external"; href: string }
  | { type: "download"; href: string; filename: string }
  | { type: "copy"; text: string; label: string }
  | { type: "game"; name: "cosmostrike" }
  | { type: "ask"; question?: string }
  | { type: "clear" }
  | { type: "exit" };
export type Result = { lines: Line[]; action?: TerminalAction; egg?: string };

const out = (text: string, tone?: Line["tone"], href?: string): Line => ({
  text,
  ...(tone ? { tone } : {}),
  ...(href ? { href } : {}),
});
const many = (items: string[], tone?: Line["tone"]) => items.map((t) => out(t, tone));

/** Splits on whitespace; "double quotes" keep words together. */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  for (let m = re.exec(input); m; m = re.exec(input)) tokens.push(m[1] ?? m[2]!);
  return tokens;
}

const { contact } = profile;
const PROJECT_ALIASES: Record<string, string> = {
  gv: "golden-verdict",
  golden: "golden-verdict",
  lan: "lansymphony",
  tour: "virtual-tour",
  vt: "virtual-tour",
};

export function findProject(query: string) {
  const q = query.toLowerCase().replace(/^\.?\/?(projects\/)?/, "");
  const slug = PROJECT_ALIASES[q] ?? q;
  return (
    profile.projects.find((p) => p.slug === slug) ??
    profile.projects.find((p) => p.name.toLowerCase().includes(q) || p.slug.includes(q))
  );
}

type Command = { summary: string; usage?: string; hidden?: boolean; run: (args: string[]) => Result };

const ws = workStatus(profile);

const commands: Record<string, Command> = {
  help: {
    summary: "list commands",
    run: () => ({
      lines: [
        out("Commands:", "accent"),
        ...Object.entries(commands)
          .filter(([, c]) => !c.hidden)
          .map(([name, c]) => out(`  ${(c.usage ?? name).padEnd(18)} ${c.summary}`)),
        out("Tab completes, ↑/↓ browse history, Ctrl+L clears, Esc closes.", "muted"),
      ],
    }),
  },
  whoami: {
    summary: "who is this?",
    run: () => ({
      lines: [
        out(`${profile.name} — ${profile.shortRole}, ${profile.location}`),
        out(profile.headline, "muted"),
      ],
    }),
  },
  about: { summary: "the short version", run: () => ({ lines: [out(profile.summary)] }) },
  status: {
    summary: "what is he doing right now?",
    run: () => ({
      lines: [
        out(
          ws.employed
            ? `Working: ${ws.employed.role} at ${ws.employed.company} (${ws.employed.period}).`
            : `Not in a full-time job or internship right now.${ws.freelance ? ` Freelancing: ${ws.freelance.role} at ${ws.freelance.company.split(",")[0]} (${ws.freelance.period}).` : ""}${ws.lastRole ? ` Most recent internship: ${ws.lastRole.role} at ${ws.lastRole.company.split(",")[0]} (${ws.lastRole.period}).` : ""}`,
        ),
        out(`Looking for: ${profile.workPreferences.roles.join("; ")}.`),
        out(
          `${profile.workPreferences.locations}; ${profile.workPreferences.modes.join(", ")}. ${profile.workPreferences.startDate}.`,
        ),
      ],
    }),
  },
  ls: {
    summary: "list sections",
    run: () => ({
      lines: [
        out("projects/  experience  skills  education  awards  certs  contact  " + RESUME_FILENAME),
        out("Try: projects, open talnio, skills, contact.", "muted"),
      ],
    }),
  },
  projects: {
    summary: "what he has shipped",
    run: () => ({
      lines: profile.projects.map((p) => out(`${p.slug.padEnd(14)} ${p.name} — ${p.tagline}`)),
    }),
  },
  open: {
    summary: "open a project or page",
    usage: "open <name>",
    run: ([target]) => {
      if (!target) return { lines: [out("usage: open <project|resume|recruiter|now|log|home>", "error")] };
      const t = target.toLowerCase();
      const pages: Record<string, string | null> = {
        home: "/",
        resume: "/resume",
        recruiter: "/recruiter",
        now: "/now",
        log: shipped.log ? "/log" : null,
      };
      if (t in pages) {
        const href = pages[t];
        return href
          ? { lines: [out(`opening ${href}`, "muted")], action: { type: "navigate", href } }
          : { lines: [out("The Ship Log has no published posts yet.", "error")] };
      }
      const p = findProject(t);
      return p
        ? {
            lines: [out(`opening ${p.name} case study`, "muted")],
            action: { type: "navigate", href: `/work/${p.slug}` },
          }
        : {
            lines: [
              out(`open: no such project or page: ${target}`, "error"),
              out("Projects: " + profile.projects.map((x) => x.slug).join(", "), "muted"),
            ],
          };
    },
  },
  experience: {
    summary: "where he has worked",
    run: () => ({
      lines: profile.experience.flatMap((e) => [
        out(`${e.role} @ ${e.company}`, "accent"),
        out(`  ${e.period}${e.current ? " (current)" : ""}`, "muted"),
        ...e.points.map((p) => out(`  - ${p}`)),
      ]),
    }),
  },
  skills: {
    summary: "what he works with",
    usage: "skills [group]",
    run: ([group]) => {
      const entries = Object.entries(profile.skills);
      const picked = group
        ? entries.filter(([k]) => k.toLowerCase().startsWith(group.toLowerCase()))
        : entries;
      if (picked.length === 0)
        return {
          lines: [out(`skills: no group "${group}". Groups: ${entries.map(([k]) => k).join(", ")}`, "error")],
        };
      return { lines: picked.map(([k, v]) => out(`${k.padEnd(10)} ${v.join(", ")}`)) };
    },
  },
  education: {
    summary: "degrees",
    run: () => ({
      lines: profile.education.map((e) => out(`${e.degree}, ${e.school} (${e.period}) — ${e.note}`)),
    }),
  },
  awards: {
    summary: "hackathon results",
    run: () => ({
      lines: profile.recognition.map((r) =>
        out(`${r.date.padEnd(9)} ${r.place} — ${r.event}${r.detail ? ` (${r.detail})` : ""}`),
      ),
    }),
  },
  certs: {
    summary: "certifications",
    run: () => ({ lines: many(profile.certifications.map((c) => `- ${c}`)) }),
  },
  contact: {
    summary: "how to reach him",
    run: () => ({
      lines: [
        out(`email     ${contact.email}`, undefined, `mailto:${contact.email}`),
        out(`phone     ${contact.phone}`, undefined, contact.phoneHref),
        out(`linkedin  ${contact.linkedin.replace(/^https?:\/\//, "")}`, undefined, contact.linkedin),
        out(`github    ${contact.github.replace(/^https?:\/\//, "")}`, undefined, contact.github),
      ],
    }),
  },
  email: {
    summary: "copy his email",
    run: () => ({
      lines: [out(contact.email)],
      action: { type: "copy", text: contact.email, label: "Email" },
    }),
  },
  phone: {
    summary: "copy his phone number",
    run: () => ({
      lines: [out(contact.phone)],
      action: { type: "copy", text: contact.phone, label: "Phone number" },
    }),
  },
  github: {
    summary: "open GitHub",
    run: () => ({
      lines: [out("opening GitHub…", "muted")],
      action: { type: "external", href: contact.github },
    }),
  },
  linkedin: {
    summary: "open LinkedIn",
    run: () => ({
      lines: [out("opening LinkedIn…", "muted")],
      action: { type: "external", href: contact.linkedin },
    }),
  },
  resume: {
    summary: "download the résumé PDF",
    run: () => ({
      lines: [out(`downloading ${RESUME_FILENAME}…`, "muted")],
      action: { type: "download", href: resumeHref, filename: RESUME_FILENAME },
    }),
  },
  recruiter: {
    summary: "the one-page version",
    run: () => ({
      lines: [out("opening Recruiter Mode…", "muted")],
      action: { type: "navigate", href: "/recruiter" },
    }),
  },
  ask: {
    summary: "ask the assistant a question",
    usage: "ask <question>",
    run: (args) => {
      const question = args.join(" ").trim().slice(0, 1000);
      return {
        lines: [out(question ? `asking: ${question}` : "opening Ask Vishal…", "muted")],
        action: question ? { type: "ask", question } : { type: "ask" },
      };
    },
  },
  ship: {
    summary: "list what he has shipped",
    usage: "ship --all",
    run: () => ({
      lines: [
        ...profile.projects.map((p) => out(`✓ ${p.name.padEnd(30)} ${p.tagline}`)),
        out("open <name> for the case study", "muted"),
      ],
    }),
  },
  cosmostrike: {
    summary: "a small arcade game",
    run: () => ({
      lines: [out("loading CosmoStrike. Esc to quit.", "muted")],
      action: { type: "game", name: "cosmostrike" },
      egg: "cosmostrike",
    }),
  },
  snake: {
    summary: "snake lives on the 404 page",
    run: () => ({
      lines: [out("heading to a page that didn't ship…", "muted")],
      action: { type: "navigate", href: "/404" },
      egg: "snake",
    }),
  },
  fortune: { summary: "words to ship by", run: () => ({ lines: [out(`"${profile.motto}"`, "accent")] }) },
  echo: { summary: "print text", usage: "echo <text>", run: (args) => ({ lines: [out(args.join(" "))] }) },
  clear: { summary: "clear the screen", run: () => ({ lines: [], action: { type: "clear" } }) },
  exit: { summary: "close the terminal", run: () => ({ lines: [], action: { type: "exit" } }) },
  // aliases, hidden from help
  quit: { summary: "", hidden: true, run: () => ({ lines: [], action: { type: "exit" } }) },
  cls: { summary: "", hidden: true, run: () => ({ lines: [], action: { type: "clear" } }) },
  cv: { summary: "", hidden: true, run: () => commands.resume!.run([]) },
  hire: { summary: "", hidden: true, run: () => ({ lines: [out("Try: sudo hire vishal", "muted")] }) },
};

export const COMMAND_NAMES = Object.entries(commands)
  .filter(([, c]) => !c.hidden)
  .map(([n]) => n);

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return dp[a.length]![b.length]!;
}

/** Runs one command line. Never throws. */
export function run(input: string): Result {
  const tokens = tokenize(input.trim());
  if (tokens.length === 0) return { lines: [] };
  const [name, ...args] = tokens as [string, ...string[]];
  const lower = name.toLowerCase();

  if (lower === "sudo") {
    const rest = args.join(" ").toLowerCase();
    if (/^hire( vishal)?$/.test(rest)) {
      return {
        lines: [
          out("[sudo] password for recruiter: ********", "muted"),
          out("Permission granted. Opening the contact form…", "accent"),
        ],
        action: { type: "navigate", href: "/#contact" },
        egg: "sudo-hire",
      };
    }
    return {
      lines: [
        out(
          `${profile.name.split(" ")[0]?.toLowerCase()} is not in the sudoers file. This incident will be reported.`,
          "error",
        ),
      ],
    };
  }
  if (/^rm$/.test(lower) && args.some((a) => a.startsWith("-"))) {
    return { lines: [out("Nice try. Everything ships; nothing gets deleted here.", "error")], egg: "rm-rf" };
  }
  if (lower === "vim" || lower === "emacs" || lower === "nano") {
    return { lines: [out(`${lower}: not installed. (Please don't start that war here.)`, "muted")] };
  }

  const cmd = Object.hasOwn(commands, lower) ? commands[lower] : undefined;
  if (cmd) return cmd.run(args);

  const near = COMMAND_NAMES.map((c) => ({ c, d: distance(lower, c) })).sort((a, b) => a.d - b.d)[0];
  return {
    lines: [
      out(`command not found: ${name}`, "error"),
      out(
        near && near.d <= 2
          ? `Did you mean "${near.c}"? Type help for the list.`
          : "Type help for the list of commands.",
        "muted",
      ),
    ],
  };
}

/** Tab completion: command names for the first word, project slugs after `open`. */
export function complete(input: string): string[] {
  const parts = input.split(/\s+/);
  const last = parts[parts.length - 1] ?? "";
  if (parts.length <= 1) return COMMAND_NAMES.filter((c) => c.startsWith(last.toLowerCase()));
  if (parts[0]!.toLowerCase() === "open") {
    return [
      ...profile.projects.map((p) => p.slug),
      "resume",
      "recruiter",
      "now",
      "home",
      ...(shipped.log ? ["log"] : []),
    ].filter((t) => t.startsWith(last.toLowerCase()));
  }
  if (parts[0]!.toLowerCase() === "skills") {
    return Object.keys(profile.skills).filter((g) => g.startsWith(last.toLowerCase()));
  }
  return [];
}

export { commonPrefix } from "./input";
