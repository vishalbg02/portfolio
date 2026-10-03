/**
 * pnpm embeddings
 * Rebuilds generated/embeddings.json: the RAG corpus (profile + case studies) and, when
 * GEMINI_API_KEY is set, its vectors. Run locally and COMMIT the result — the Vercel build never
 * calls the API.
 *
 *  - Only chunks whose text changed are re-embedded (cheap to re-run).
 *  - Without a key the chunks are still refreshed; chunks lacking vectors fall back to keyword search.
 */
import { embedMany } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { EMBEDDING_DIMS, MODELS } from "@/lib/ai/models";
import { buildCorpus } from "@/lib/rag/chunks";
import { contentHash, textHash } from "@/lib/rag/hash";
import type { EmbeddedChunk, EmbeddingsFile } from "@/lib/rag/types";

const OUT = "generated/embeddings.json";
const round = (v: number) => Math.round(v * 1e5) / 1e5; // 5 decimals: ~6× smaller file, no ranking change

async function main() {
  const corpus = await buildCorpus();
  const previous: EmbeddingsFile | null = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
  const reusable = new Map<string, EmbeddedChunk>(
    previous && previous.model === MODELS.embedding && previous.dims === EMBEDDING_DIMS
      ? previous.chunks.map((c) => [c.id, c])
      : [],
  );

  const chunks: EmbeddedChunk[] = corpus.map((c) => {
    const th = textHash(c);
    const old = reusable.get(c.id);
    return { ...c, textHash: th, embedding: old && old.textHash === th ? old.embedding : null };
  });

  const missing = chunks.filter((c) => !c.embedding);
  const key = process.env.GEMINI_API_KEY;
  if (missing.length > 0 && key) {
    console.log(
      `Embedding ${missing.length} of ${chunks.length} chunks with ${MODELS.embedding} (${EMBEDDING_DIMS} dims)…`,
    );
    const google = createGoogleGenerativeAI({ apiKey: key });
    const { embeddings } = await embedMany({
      model: google.embedding(MODELS.embedding),
      values: missing.map((c) => `${c.title}\n${c.text}`),
      providerOptions: { google: { outputDimensionality: EMBEDDING_DIMS, taskType: "RETRIEVAL_DOCUMENT" } },
      maxParallelCalls: 2,
    });
    missing.forEach((c, i) => (c.embedding = embeddings[i]!.map(round)));
  } else if (missing.length > 0) {
    console.warn(
      `⚠ ${missing.length} chunk(s) have no vectors (no GEMINI_API_KEY). Keyword search will be used for them.`,
    );
  } else {
    console.log("All vectors are up to date.");
  }

  const file: EmbeddingsFile = {
    version: 1,
    model: MODELS.embedding,
    dims: EMBEDDING_DIMS,
    contentHash: contentHash(corpus, MODELS.embedding, EMBEDDING_DIMS),
    generatedAt: new Date().toISOString(),
    chunks,
  };
  writeFileSync(OUT, JSON.stringify(file) + "\n");
  const withVectors = chunks.filter((c) => c.embedding).length;
  console.log(`✓ ${OUT} — ${chunks.length} chunks, ${withVectors} with vectors, hash ${file.contentHash}`);
}

void main();
