/**
 * pnpm check:embeddings
 * Compares generated/embeddings.json with the current site content. Prints a WARNING (never fails the
 * build, never calls the API) when the corpus is stale or lacks vectors, so CI can nudge you to run
 * `pnpm embeddings`.
 */
import { existsSync, readFileSync } from "node:fs";
import { EMBEDDING_DIMS, MODELS } from "@/lib/ai/models";
import { buildCorpus } from "@/lib/rag/chunks";
import { contentHash } from "@/lib/rag/hash";
import type { EmbeddingsFile } from "@/lib/rag/types";

const FILE = "generated/embeddings.json";
const warn = (msg: string) =>
  console.log(process.env.GITHUB_ACTIONS ? `::warning title=RAG embeddings::${msg}` : `⚠ ${msg}`);

async function main() {
  if (!existsSync(FILE)) return warn(`${FILE} is missing — run \`pnpm embeddings\` and commit it.`);
  const file = JSON.parse(readFileSync(FILE, "utf8")) as EmbeddingsFile;
  const current = contentHash(await buildCorpus(), MODELS.embedding, EMBEDDING_DIMS);
  if (file.contentHash !== current) {
    return warn(
      "The AI assistant's knowledge is STALE: site content changed since the last `pnpm embeddings`. Run it and commit generated/embeddings.json.",
    );
  }
  const total = file.chunks.length;
  const withVectors = file.chunks.filter((c) => c.embedding).length;
  if (withVectors < total) {
    return warn(
      `${total - withVectors}/${total} chunks have no vectors — semantic search is off for them. Run \`GEMINI_API_KEY=… pnpm embeddings\` and commit.`,
    );
  }
  console.log(`✓ RAG embeddings are up to date (${total} chunks, hash ${file.contentHash}).`);
}

void main();
