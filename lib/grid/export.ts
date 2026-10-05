import type { Msg } from "./store";
import type { UiPart } from "@/lib/ai/protocol";

const describe = (p: UiPart): string => {
  switch (p.kind) {
    case "project":
      return `[card] Project: ${p.name}, ${p.tagline}`;
    case "brief":
      return `[card] Brief: ${p.who}. ${p.status} Proof: ${p.proofs.map((x) => x.title).join(", ")}`;
    case "role":
      return `[card] Role: ${p.title}, ${p.short} (${p.period})`;
    case "contact":
      return `[card] Contact: ${p.items.map((i) => `${i.label} ${i.value}`).join(", ")}`;
    case "skill":
      return `[card] Where he used ${p.skill}: ${p.found ? p.where.map((w) => w.title).join("; ") : "not listed on the site"}`;
    case "stats":
      return "[card] Site stats (Lighthouse, last deploy, live status)";
    case "diagram":
      return `[card] Architecture diagram: ${p.name}`;
    case "demo":
      return `[card] Walkthrough: ${p.label}`;
    case "navigate":
      return `[card] Went to: ${p.label}`;
    case "match":
      return "[card] Job-description match";
    case "confirm":
      return "[card] A message to Vishal, for the visitor to confirm";
    case "draft":
      return `[card] Draft: ${p.subject}`;
    case "resume":
      return `[card] Tailored résumé${p.role ? ` for ${p.role}` : ""}`;
    case "book":
      return p.calLink ? "[card] Book a call" : "[card] Book a call (not set up yet)";
    case "tour":
      return "[card] The 60-second tour";
    case "live":
      return p.state === "off" ? "[card] Leave a message for Vishal" : `[card] Message Vishal (${p.state})`;
    case "interview":
      return p.answer
        ? `[card] In his own words: ${p.question}`
        : `[card] No written answer yet: ${p.question}`;
  }
};

/** The conversation as Markdown, for "Export transcript". Plain text only: no HTML, nothing the page didn't show. */
export function toTranscript(messages: Msg[], origin: string, when: Date = new Date()): string {
  const lines = [`# Conversation with GRID`, "", `${when.toISOString().slice(0, 10)} · ${origin}`, ""];
  for (const m of messages) {
    if (m.role === "user") {
      lines.push(`**You:** ${m.text}`, "");
      continue;
    }
    lines.push(`**GRID:** ${m.text || "(no text)"}`);
    for (const { part } of m.parts) lines.push(`> ${describe(part)}`);
    if (m.sources.length > 0) {
      lines.push("", "Sources:");
      for (const s of m.sources) lines.push(`- [${s.n}] ${s.title}: ${origin}${s.url}`);
    }
    if (m.error) lines.push(`> ${m.error}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}
