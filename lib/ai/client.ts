import { EventParser, type ChatEvent, type ChatMessage } from "./protocol";

export class ChatHttpError extends Error {
  constructor(
    public status: number,
    public retryAfterSec?: number,
  ) {
    super(`chat request failed: ${status}`);
  }
}

/** POSTs the conversation and invokes `onEvent` for each streamed event. Rejects with ChatHttpError on non-2xx. */
export async function streamChat(
  messages: ChatMessage[],
  onEvent: (e: ChatEvent) => void,
  signal?: AbortSignal,
  opts: { project?: string; mode?: string; lang?: string } = {},
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, project: opts.project, mode: opts.mode, lang: opts.lang }),
    signal,
  });
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { retryAfterSec?: number } | null;
    throw new ChatHttpError(res.status, body?.retryAfterSec);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  const parser = new EventParser();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    for (const e of parser.push(value)) onEvent(e);
  }
}
