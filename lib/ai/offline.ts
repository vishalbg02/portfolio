import { profile } from "@/content/profile";
import type { Retrieved } from "@/lib/rag/types";
import type { OfflineReason, Source } from "./protocol";

/** Up to `max` chars, cut at the last sentence end (or word) so excerpts never stop mid-word. */
export function excerpt(text: string, max = 300): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  return (
    (sentence > max * 0.5 ? cut.slice(0, sentence + 1) : cut.slice(0, cut.lastIndexOf(" "))).trimEnd() +
    (sentence > max * 0.5 ? "" : "…")
  );
}

export const toSources = (results: Retrieved[]): Source[] =>
  results.map((r, i) => ({ n: i + 1, title: r.chunk.title, url: r.chunk.url }));

export const REFUSAL_TEXT = `I couldn't find that in ${profile.name}'s profile. I can answer questions about his projects, experience, skills, education and awards — or you can reach him directly at ${profile.contact.email}.`;

const INTRO: Record<OfflineReason, string> = {
  no_key: "The AI assistant is offline right now, so here is what the site says about that:",
  budget: "The AI assistant has reached its daily limit, so here is what the site says about that:",
  error: "The AI assistant isn't responding, so here is what the site says about that:",
  off_topic: "",
};

/** Deterministic, model-free answer: the best passages with citations. Used whenever the model can't be. */
export function offlineAnswer(
  results: Retrieved[],
  reason: OfflineReason,
): { text: string; sources: Source[] } {
  const top = results.slice(0, 2);
  const lines = top.map(
    (r, i) =>
      `- **${r.chunk.title}** — ${excerpt(r.chunk.text.replace(/^[^:]*case study, [^:]*: /, ""))} [${i + 1}]`,
  );
  return { text: `${INTRO[reason]}\n\n${lines.join("\n")}`, sources: toSources(top) };
}
