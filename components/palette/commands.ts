import { profile } from "@/content/profile";
import { RESUME_FILENAME } from "@/lib/resume/model";
import { resumeHref, shipped } from "@/lib/site";
import type { AnalyticsEvent } from "@/lib/analytics";

/**
 * Command palette registry. Data-driven (no closures) so it can be unit-tested:
 * every link must resolve to a shipped route or an absolute URL.
 */
export type PaletteAction =
  | { type: "route"; href: string }
  | { type: "external"; href: string; event?: AnalyticsEvent }
  | { type: "download"; href: string; filename?: string; event?: AnalyticsEvent }
  | { type: "tel"; href: string }
  | { type: "copy"; text: string; label: string; event?: AnalyticsEvent }
  | { type: "event"; name: "open-terminal" | "toggle-recruiter" };

export type PaletteItem = {
  id: string;
  label: string;
  hint?: string;
  keywords?: string[];
  action: PaletteAction;
};

export type PaletteGroup = { heading: string; items: PaletteItem[] };

const { contact } = profile;

export function buildPaletteGroups(): PaletteGroup[] {
  const navigate: PaletteItem[] = [
    {
      id: "nav-home",
      label: "Home",
      hint: "/",
      keywords: ["top", "start"],
      action: { type: "route", href: "/" },
    },
    {
      id: "nav-work",
      label: "Work",
      hint: "#work",
      keywords: ["projects", "selected"],
      action: { type: "route", href: "/#work" },
    },
    {
      id: "nav-experience",
      label: "Experience",
      hint: "#experience",
      keywords: ["intern", "jobs", "timeline"],
      action: { type: "route", href: "/#experience" },
    },
    ...(shipped.log
      ? [
          {
            id: "nav-log",
            label: "Ship Log",
            hint: "/log",
            keywords: ["blog", "posts"],
            action: { type: "route", href: "/log" },
          } satisfies PaletteItem,
        ]
      : []),
    ...(shipped.now
      ? [
          {
            id: "nav-now",
            label: "Now",
            hint: "/now",
            keywords: ["building", "learning"],
            action: { type: "route", href: "/now" },
          } satisfies PaletteItem,
        ]
      : []),
    ...(shipped.resume
      ? [
          {
            id: "nav-resume",
            label: "Résumé",
            hint: "/resume",
            keywords: ["cv", "experience", "skills"],
            action: { type: "route", href: "/resume" },
          } satisfies PaletteItem,
        ]
      : []),
    {
      id: "nav-contact",
      label: "Contact",
      hint: "#contact",
      keywords: ["email", "reach", "hire"],
      action: { type: "route", href: "/#contact" },
    },
  ];

  const actions: PaletteItem[] = [
    {
      id: "act-copy-email",
      label: "Copy email",
      hint: contact.email,
      keywords: ["mail", "address"],
      action: { type: "copy", text: contact.email, label: "Email", event: "copy_email" },
    },
    {
      id: "act-copy-phone",
      label: "Copy phone",
      hint: contact.phone,
      keywords: ["number", "mobile"],
      action: { type: "copy", text: contact.phone, label: "Phone", event: "copy_phone" },
    },
    {
      id: "act-call",
      label: "Call",
      hint: contact.phone,
      keywords: ["phone", "dial", "tel"],
      action: { type: "tel", href: contact.phoneHref },
    },
    {
      id: "act-whatsapp",
      label: "WhatsApp",
      hint: "↗",
      keywords: ["chat", "message"],
      action: { type: "external", href: contact.whatsapp },
    },
    {
      id: "act-resume",
      label: "Download résumé",
      hint: "PDF",
      keywords: ["cv", "resume"],
      action: { type: "download", href: resumeHref, filename: RESUME_FILENAME, event: "resume_download" },
    },
    {
      id: "act-linkedin",
      label: "Open LinkedIn",
      hint: "↗",
      keywords: ["social"],
      action: { type: "external", href: contact.linkedin },
    },
    {
      id: "act-github",
      label: "Open GitHub",
      hint: "↗",
      keywords: ["code", "repos", "social"],
      action: { type: "external", href: contact.github },
    },
    ...(shipped.terminal
      ? [
          {
            id: "act-terminal",
            label: "Open terminal",
            hint: "~",
            keywords: ["shell", "console", "cli"],
            action: { type: "event", name: "open-terminal" },
          } satisfies PaletteItem,
        ]
      : []),
    ...(shipped.recruiter
      ? [
          {
            id: "act-recruiter",
            label: "Toggle Recruiter Mode",
            keywords: ["dense", "summary"],
            action: { type: "event", name: "toggle-recruiter" },
          } satisfies PaletteItem,
        ]
      : []),
  ];

  const projects: PaletteItem[] = profile.projects.flatMap((p) => {
    const items: PaletteItem[] = [];
    if (shipped.caseStudies) {
      items.push({
        id: `proj-${p.slug}-case`,
        label: `${p.name} — case study`,
        hint: p.tagline,
        keywords: [p.slug, ...p.stack],
        action: { type: "route", href: `/work/${p.slug}` },
      });
    }
    if (p.live) {
      items.push({
        id: `proj-${p.slug}-live`,
        label: `${p.name} — open live site`,
        hint: "↗",
        keywords: [p.slug, "live", "demo"],
        action: { type: "external", href: p.live, event: "project_live_click" },
      });
    }
    return items;
  });

  return [
    { heading: "Navigate", items: navigate },
    { heading: "Actions", items: actions },
    ...(projects.length > 0 ? [{ heading: "Projects", items: projects }] : []),
  ];
}
