/**
 * Chat streaming protocol (NDJSON, one event per line). Shared by server and client, and the same
 * for the model-backed and the offline answer, so the UI has one code path.
 *
 *   {"t":"meta","mode":"ai","sources":[{"n":1,"title":"…","url":"/work/talnio"}]}
 *   {"t":"text","d":"Vishal built …"}      (repeated)
 *   {"t":"done"}
 */
export type Source = { n: number; title: string; url: string };

export type ChatMode = "ai" | "offline" | "refusal";
export type OfflineReason = "no_key" | "budget" | "error" | "off_topic";

export type ChatEvent =
  | { t: "meta"; mode: ChatMode; sources: Source[]; reason?: OfflineReason }
  | { t: "text"; d: string }
  | { t: "done" }
  | { t: "error"; message: string };

export const encodeEvent = (e: ChatEvent) => JSON.stringify(e) + "\n";

/** Incremental NDJSON parser: feed chunks, get complete events (partial lines are buffered). */
export class EventParser {
  private buf = "";
  push(chunk: string): ChatEvent[] {
    this.buf += chunk;
    const lines = this.buf.split("\n");
    this.buf = lines.pop() ?? "";
    const out: ChatEvent[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line) as ChatEvent;
        if (e && typeof e === "object" && "t" in e) out.push(e);
      } catch {
        /* ignore a corrupt line rather than break the stream */
      }
    }
    return out;
  }
}

export type ChatMessage = { role: "user" | "assistant"; content: string };
