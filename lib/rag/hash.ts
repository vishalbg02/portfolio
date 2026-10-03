import { createHash } from "node:crypto";
import type { Chunk } from "./types";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export const textHash = (c: Chunk) => sha(`${c.id}\n${c.title}\n${c.url}\n${c.text}`).slice(0, 16);

/** Changes whenever any chunk, the embedding model or the vector size changes. */
export function contentHash(chunks: Chunk[], model: string, dims: number): string {
  return sha(
    JSON.stringify({ model, dims, chunks: chunks.map((c) => [c.id, c.title, c.url, c.text]) }),
  ).slice(0, 24);
}
