import { profile } from "@/content/profile";
import { singleLine } from "@/lib/contact/rules";
import { site } from "@/lib/site";

/**
 * The two emails the contact form can send, in the same GitHub-dark theme as the site: a contribution-square
 * header, mono labels, one green accent, flat colours (no gradients, nothing to load: no images, no web fonts).
 *  - `ownerEmail`: what Vishal receives (the visitor's message, with a one-tap reply).
 *  - `visitorEmail`: the confirmation the visitor gets. It can only be sent from a verified domain
 *    (Resend's shared sender delivers to the account owner only), so the route sends it only when
 *    CONTACT_FROM_EMAIL is set to one: see `canAutoReply`.
 * Everything a visitor typed is HTML-escaped; layout is tables with inline styles because that is what mail clients render.
 */
const C = {
  bg: "#0d1117",
  card: "#161b22",
  border: "#30363d",
  text: "#e6edf3",
  muted: "#8b949e",
  accent: "#3fb950",
  link: "#58a6ff",
  grid: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
} as const;
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export type Submission = { name: string; email: string; org?: string | null; message: string };
export type Email = { subject: string; html: string; text: string };

export const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const para = (s: string) => esc(s).replace(/\r?\n/g, "<br>");
/** Subjects are plain text, but strip angle brackets anyway so a name can never look like markup in a preview pane. */
const subj = (t: string) => singleLine(t).replace(/[<>]/g, "");
export const firstName = (name: string) => singleLine(name).split(" ")[0]!.slice(0, 40) || "there";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "4 Oct 2026, 10:42 IST": deterministic (no ICU), like the footer's build date. */
export function istStamp(now: Date): string {
  const ist = new Date(now.getTime() + 330 * 60_000);
  const hh = String(ist.getUTCHours()).padStart(2, "0");
  const mm = String(ist.getUTCMinutes()).padStart(2, "0");
  return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]} ${ist.getUTCFullYear()}, ${hh}:${mm} IST`;
}

/** A row of contribution squares (deterministic pattern, like the activity calendar). */
function squares(): string {
  const levels = [0, 1, 0, 2, 3, 1, 0, 4, 2, 1, 3, 0, 2, 4, 3, 1, 0, 2, 4, 3, 1, 2, 0, 3, 4, 2, 1, 3, 0, 1];
  const cells = levels
    .map(
      (l) =>
        `<td width="14" height="14" bgcolor="${C.grid[l]}" style="width:14px;height:14px;background:${C.grid[l]};border-radius:3px;font-size:0;line-height:0;${l === 0 ? `border:1px solid ${C.border};` : ""}">&nbsp;</td><td width="4" style="width:4px;font-size:0;line-height:0;">&nbsp;</td>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>`;
}

function button(href: string, label: string, solid: boolean): string {
  const style = solid
    ? `background:${C.accent};color:${C.bg};border:1px solid ${C.accent};`
    : `background:${C.card};color:${C.text};border:1px solid ${C.border};`;
  return `<a href="${esc(href)}" style="display:inline-block;${style}border-radius:6px;padding:10px 18px;font-family:${SANS};font-size:14px;font-weight:600;text-decoration:none;margin:0 8px 8px 0;">${esc(label)}</a>`;
}

function shell({
  preheader,
  title,
  body,
  footer,
}: {
  preheader: string;
  title: string;
  body: string;
  footer: string;
}) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};color:${C.text};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg};">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg};">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="padding:0 4px 18px 4px;">${squares()}</td></tr>
<tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.border};border-radius:10px;padding:28px 26px;font-family:${SANS};">
<p style="margin:0 0 18px 0;font-family:${MONO};font-size:13px;color:${C.muted};">~/<span style="color:${C.text};">vishalbg</span><span style="display:inline-block;width:8px;height:14px;background:${C.accent};margin-left:4px;vertical-align:-2px;">&nbsp;</span></p>
${body}
</td></tr>
<tr><td style="padding:16px 8px 0 8px;font-family:${MONO};font-size:12px;line-height:1.6;color:${C.muted};">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

const label = (t: string) =>
  `<p style="margin:0 0 4px 0;font-family:${MONO};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${C.muted};">${esc(t)}</p>`;
const quote = (message: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${C.bg}" style="background:${C.bg};border-left:3px solid ${C.accent};border-radius:4px;padding:14px 16px;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.text};">${para(message)}</td></tr></table>`;

/** What Vishal receives. */
export function ownerEmail(
  sub: Submission,
  now: Date = new Date(),
  source: string = "the contact form",
): Email {
  const name = singleLine(sub.name);
  const org = sub.org ? singleLine(sub.org) : "";
  const subject = `Portfolio message from ${subj(name)}${org ? ` (${subj(org)})` : ""}`;
  const reply = `mailto:${sub.email}?subject=${encodeURIComponent(`Re: ${subject}`)}`;
  const row = (k: string, v: string) =>
    `<tr><td style="padding:5px 16px 5px 0;font-family:${MONO};font-size:12px;color:${C.muted};white-space:nowrap;vertical-align:top;">${esc(k)}</td><td style="padding:5px 0;font-family:${SANS};font-size:14px;color:${C.text};">${v}</td></tr>`;
  const html = shell({
    preheader: `${name}: ${singleLine(sub.message).slice(0, 90)}`,
    title: subject,
    body: `<h1 style="margin:0 0 18px 0;font-size:22px;line-height:1.3;color:${C.text};font-family:${SANS};">New message from ${esc(firstName(name))}</h1>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;">
${row("From", esc(name))}${row("Email", `<a href="mailto:${esc(sub.email)}" style="color:${C.link};text-decoration:none;">${esc(sub.email)}</a>`)}${org ? row("Role / company", esc(org)) : ""}${row("Sent", esc(istStamp(now)))}
</table>
${label("Message")}
${quote(sub.message)}
<p style="margin:24px 0 0 0;">${button(reply, `Reply to ${firstName(name)}`, true)}${button(site.url, "Open the portfolio", false)}</p>`,
    footer: `Sent from ${esc(source)} at ${esc(site.url.replace(/^https?:\/\//, ""))}. Replying to this email goes straight to ${esc(name)}.`,
  });
  const text = `New message from ${name}\n\nFrom: ${name}\nEmail: ${sub.email}${org ? `\nRole / company: ${org}` : ""}\nSent: ${istStamp(now)}\n\n${sub.message}\n\n—\nReply to this email to answer ${firstName(name)} directly.\nSent from ${source} at ${site.url}`;
  return { subject, html, text };
}

/** The confirmation the visitor gets (only sent from a verified domain: see canAutoReply). */
export function visitorEmail(sub: Submission): Email {
  const first = firstName(sub.name);
  const { contact, workPreferences } = profile;
  const subject = `Got your message, ${subj(first)}`;
  const reach = `${profile.status}. ${workPreferences.startDate}.`;
  const html = shell({
    preheader: `Thanks for reaching out, ${first}. I'll reply from ${contact.email}.`,
    title: subject,
    body: `<h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:${C.text};font-family:${SANS};">Got your message, ${esc(first)}.</h1>
<p style="margin:0 0 20px 0;font-size:15px;line-height:1.65;color:${C.muted};font-family:${SANS};">Thanks for reaching out. It landed in my inbox and I'll reply from ${esc(contact.email)}, usually within a few hours (Bengaluru, IST).</p>
${label("What you sent")}
${quote(sub.message)}
<p style="margin:22px 0 6px 0;font-family:${MONO};font-size:12px;line-height:1.6;color:${C.muted};"><span style="color:${C.accent};">●</span> ${esc(reach)}</p>
<p style="margin:18px 0 0 0;">${button(`${site.url}/resume.pdf`, "Résumé (PDF)", true)}${button(contact.github, "GitHub", false)}${button(contact.linkedin, "LinkedIn", false)}</p>`,
    footer: `You're getting this once because you used the contact form at ${esc(site.url.replace(/^https?:\/\//, ""))}. No newsletter, no tracking, nothing else will follow.`,
  });
  const text = `Got your message, ${first}.\n\nThanks for reaching out. It landed in my inbox and I'll reply from ${contact.email}, usually within a few hours (Bengaluru, IST).\n\nWhat you sent:\n${sub.message}\n\n${reach}\nRésumé: ${site.url}/resume.pdf\nGitHub: ${contact.github}\nLinkedIn: ${contact.linkedin}\n\nYou're getting this once because you used the contact form at ${site.url}. No newsletter, no tracking.`;
  return { subject, html, text };
}

/**
 * Whether the visitor confirmation can be sent. Resend's shared `onboarding@resend.dev` sender only delivers
 * to the account owner, so it needs a sender on a verified domain (CONTACT_FROM_EMAIL).
 */
export function canAutoReply(from: string | undefined): boolean {
  return Boolean(from) && !/@resend\.dev\b/i.test(from!);
}

/**
 * Vishal's reply, emailed to a visitor who left the chat (see lib/live). Plain and short: his words in a quote, one
 * button back to the thread, and a one-click way to stop. Like the other mail it can only go from a verified domain.
 */
export function replyEmail(
  sub: { name: string },
  reply: string,
  links: { thread: string; unsubscribe: string },
): Email {
  const first = firstName(sub.name);
  const subject = "Vishal replied to your message";
  const host = esc(site.url.replace(/^https?:\/\//, ""));
  const html = shell({
    preheader: singleLine(reply).slice(0, 90),
    title: subject,
    body: `<h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:${C.text};font-family:${SANS};">Hi ${esc(first)}, he replied.</h1>
<p style="margin:0 0 20px 0;font-size:15px;line-height:1.65;color:${C.muted};font-family:${SANS};">You left the chat before he answered, so here it is.</p>
${label("His reply")}
${quote(reply)}
<p style="margin:24px 0 0 0;">${button(links.thread, "Continue the conversation", true)}</p>`,
    footer: `You're getting this because you left your email in the chat at ${host}. Threads are deleted after 30 days. <a href="${esc(links.unsubscribe)}" style="color:${C.muted};">Stop emails about this conversation</a>.`,
  });
  const text = `Hi ${first}, he replied.\n\nYou left the chat before he answered, so here it is.\n\nHis reply:\n${reply}\n\nContinue the conversation: ${links.thread}\n\nYou're getting this because you left your email in the chat at ${site.url}. Threads are deleted after 30 days.\nStop emails about this conversation: ${links.unsubscribe}`;
  return { subject, html, text };
}
