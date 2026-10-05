import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { interviewChunks } from "@/lib/rag/chunks";
import { setAnswer } from "@/lib/content/interview-edit";

const SOURCE = readFileSync("content/interview.ts", "utf8");

/** The answer value of one entry, parsed back from the source (null or the string). */
function answerOf(source: string, id: string): string | null {
  const start = source.indexOf(`id: ${JSON.stringify(id)},`);
  const m = /answer:\s*(null|"(?:[^"\\]|\\.)*")/.exec(source.slice(start));
  return JSON.parse(m![1]!) as string | null;
}

describe("pnpm interview: setAnswer edits one answer and nothing else", () => {
  it("writes an answer into the right entry, and only there", () => {
    const text = "I build things end to end, then I measure them and make them better.";
    const out = setAnswer(SOURCE, "about-me", text);
    expect(answerOf(out, "about-me")).toBe(text);
    expect(answerOf(out, "proud-project")).toBeNull();
    // everything outside that one line is untouched
    expect(out.replace(JSON.stringify(text) + ",", "null, // TODO(vishal)")).toBe(SOURCE);
  });

  it("keeps quotes, backslashes, backticks, ${…} and line breaks exactly", () => {
    const text = 'He said "ship it" — C:\\path, `code`, ${not a template}\nand a second line.';
    expect(answerOf(setAnswer(SOURCE, "weakness", text), "weakness")).toBe(text);
  });

  it("round-trips: an answer can be removed again (back to TODO)", () => {
    const once = setAnswer(SOURCE, "why-hire", "Because the work on this site shows how I build things.");
    expect(setAnswer(once, "why-hire", null)).toBe(SOURCE);
  });

  it("replaces an existing answer, including one prettier wrapped onto its own line", () => {
    const wrapped = SOURCE.replace(
      /(id: "learning",[\s\S]*?)answer: null, \/\/ TODO\(vishal\)/,
      '$1answer:\n        "An older answer that was long enough to be wrapped by prettier.",',
    );
    const out = setAnswer(wrapped, "learning", "A new answer, in my own words, at least twenty characters.");
    expect(answerOf(out, "learning")).toBe("A new answer, in my own words, at least twenty characters.");
    expect(out).not.toContain("An older answer");
  });

  it("refuses an id that does not exist", () => {
    expect(() => setAnswer(SOURCE, "nope", "Something long enough to be an answer.")).toThrow(
      /no interview entry/,
    );
  });
});

describe("his written answers are part of what GRID can retrieve, verbatim", () => {
  it("one chunk per answered question, none for unanswered ones", () => {
    const notes = [
      {
        id: "about-me",
        question: "Tell me about yourself.",
        aliases: [],
        answer: "I am a full-stack developer.",
      },
    ];
    expect(interviewChunks({ name: "Vishal B G" }, notes)).toEqual([
      {
        id: "interview-about-me",
        title: "In his own words: Tell me about yourself.",
        url: "/#ask",
        text: 'Interview question "Tell me about yourself." — Vishal B G\'s own answer, in his words: I am a full-stack developer.',
      },
    ]);
    expect(interviewChunks({ name: "Vishal B G" }, [])).toEqual([]);
  });
});
