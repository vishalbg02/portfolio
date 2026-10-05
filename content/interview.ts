import { z } from "zod";

/**
 * ✏️  INTERVIEW NOTES: written BY VISHAL, in his own words.
 *
 * GRID's Interview mode answers only from the entries below that have an `answer`, plus the facts in
 * content/profile.ts. For every question that still has `answer: null` GRID says it has not been told yet and
 * offers to send the question to him. Nothing here is ever invented or paraphrased by the AI.
 *
 * TODO(vishal): write your own answer for each question (2–5 sentences each, first person is fine: GRID shows
 * your words as a quote, "In his own words"). Interview mode appears on the site once at least 3 are answered.
 */
export const InterviewEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  question: z.string().trim().min(8).max(140),
  /** Words a visitor might use for the same question, so "your biggest weakness?" finds the weakness note. */
  aliases: z.array(z.string().trim().min(2).max(60)).max(8),
  /** His own answer, or null until he writes it. Plain text, max 900 characters. */
  answer: z.string().trim().min(20).max(900).nullable(),
});
export type InterviewEntry = z.infer<typeof InterviewEntrySchema>;

export const interviewBank: InterviewEntry[] = z
  .array(InterviewEntrySchema)
  .length(12)
  .parse([
    {
      id: "about-me",
      question: "Tell me about yourself.",
      aliases: ["introduce yourself", "walk me through your background", "who are you"],
      answer: null, // TODO(vishal)
    },
    {
      id: "proud-project",
      question: "Which project are you most proud of, and why?",
      aliases: ["best project", "favourite project", "favorite project", "project you are proud of"],
      answer: null, // TODO(vishal)
    },
    {
      id: "hardest-problem",
      question: "Tell me about the hardest bug or problem you solved.",
      aliases: ["toughest bug", "difficult problem", "challenging problem", "hardest challenge"],
      answer: null, // TODO(vishal)
    },
    {
      id: "teamwork",
      question: "Describe a time you worked in a team and handled a disagreement.",
      aliases: ["working in a team", "conflict with a teammate", "disagreement", "team player"],
      answer: null, // TODO(vishal)
    },
    {
      id: "why-java",
      question: "Why do you work with Java and Spring Boot?",
      aliases: ["why java", "why spring boot", "choose java", "backend stack choice"],
      answer: null, // TODO(vishal)
    },
    {
      id: "learning",
      question: "How do you learn a new technology quickly?",
      aliases: ["learn new technologies", "learning style", "pick up new tools"],
      answer: null, // TODO(vishal)
    },
    {
      id: "weakness",
      question: "What is a weakness you are working on?",
      aliases: ["biggest weakness", "areas to improve", "what are your weaknesses"],
      answer: null, // TODO(vishal)
    },
    {
      id: "strongest-skill",
      question: "What is your strongest technical skill, and how do you know?",
      aliases: ["greatest strength", "best skill", "what are you best at"],
      answer: null, // TODO(vishal)
    },
    {
      id: "ownership",
      question: "Tell me about a time you owned something end to end.",
      aliases: ["end to end ownership", "took ownership", "built from scratch"],
      answer: null, // TODO(vishal)
    },
    {
      id: "deadlines",
      question: "How do you handle tight deadlines and pressure?",
      aliases: ["working under pressure", "meeting deadlines", "time management"],
      answer: null, // TODO(vishal)
    },
    {
      id: "why-hire",
      question: "Why should we hire you?",
      aliases: ["what do you bring", "why you", "what makes you a good fit"],
      answer: null, // TODO(vishal)
    },
    {
      id: "five-years",
      question: "Where do you see yourself in five years?",
      aliases: ["career goals", "long term goals", "future plans"],
      answer: null, // TODO(vishal)
    },
  ]);

/** Interview mode is offered once he has written at least this many answers. */
export const INTERVIEW_MIN_ANSWERS = 3;
export const answeredNotes = () => interviewBank.filter((e) => e.answer !== null);
export const interviewReady = () => answeredNotes().length >= INTERVIEW_MIN_ANSWERS;
