import { interviewBank, type InterviewEntry } from "@/content/interview";
import { profile } from "@/content/profile";
import type { UiPart } from "../protocol";
import { norm } from "./jd";

/**
 * Finds the interview note a question is asking for. Matching is on words (with a few endings folded), against the
 * note's question and its aliases, so "what's your biggest weakness?" finds the weakness note. No model is involved,
 * and a note is shown exactly as Vishal wrote it.
 */
const STOP = new Set(
  "the a an and or of to in on at for with you your yours are is was were do does did what why how tell me about describe who which when would should could can will have has had been this that there their them they any some one our us".split(
    " ",
  ),
);
const stem = (w: string) => {
  const s = w.replace(/(?:ing|est|ed|es|s)$/, "");
  return s.length >= 3 ? s : w;
};
const tokens = (s: string) =>
  new Set(
    norm(s)
      .split(" ")
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map(stem),
  );

const overlap = (a: Set<string>, b: Set<string>) => {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / Math.min(a.size, b.size);
};

export function findInterviewNote(
  text: string,
  bank: InterviewEntry[] = interviewBank,
): { entry: InterviewEntry; score: number } | null {
  const q = tokens(text);
  const plain = norm(text);
  let best: { entry: InterviewEntry; score: number } | null = null;
  for (const entry of bank) {
    const candidates = [entry.question, ...entry.aliases];
    const phrase = entry.aliases.some((a) => plain.includes(norm(a)));
    const score = phrase ? 1 : Math.max(...candidates.map((c) => overlap(q, tokens(c))));
    if (!best || score > best.score) best = { entry, score };
  }
  return best && best.score >= 0.6 ? best : null;
}

export function interviewCard(text: string, bank: InterviewEntry[] = interviewBank): UiPart {
  const hit = findInterviewNote(text, bank);
  return hit
    ? {
        kind: "interview",
        question: hit.entry.question,
        answer: hit.entry.answer,
        matched: hit.entry.id,
        mailto: profile.contact.email,
      }
    : {
        kind: "interview",
        question: text.trim().slice(0, 140),
        answer: null,
        matched: null,
        mailto: profile.contact.email,
      };
}
