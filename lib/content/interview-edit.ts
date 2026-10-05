/**
 * Edits one answer in the source of content/interview.ts, for `pnpm interview`. Pure (text in, text out), so it is
 * unit-tested; the CLI only reads the file, calls this, and writes it back. Only the `answer` of the entry with that id
 * changes: questions, aliases and comments are left exactly as they are.
 */
const ANSWER = /answer:\s*(?:null|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)\s*,?[^\n]*/;

export function setAnswer(source: string, id: string, answer: string | null): string {
  const marker = `id: ${JSON.stringify(id)},`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`no interview entry with id "${id}"`);
  // the entry ends where the next one starts (or the list ends)
  const next = source.indexOf("\n    {", start);
  const end = next < 0 ? source.indexOf("\n  ]", start) : next;
  const entry = source.slice(start, end < 0 ? undefined : end);
  if (!ANSWER.test(entry)) throw new Error(`entry "${id}" has no answer field`);
  const value =
    answer === null
      ? "answer: null, // TODO(vishal)"
      : `answer: ${JSON.stringify(answer.replace(/\r\n?/g, "\n").trim())},`;
  return source.slice(0, start) + entry.replace(ANSWER, () => value) + source.slice(start + entry.length);
}
