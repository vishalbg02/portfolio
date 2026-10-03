import "server-only";
import file from "@/generated/embeddings.json";
import { Retriever } from "./retrieve";
import type { EmbeddedChunk, EmbeddingsFile } from "./types";

/** The committed corpus (text + vectors), loaded once per server instance. No filesystem access at runtime. */
const data = file as unknown as EmbeddingsFile;
let retriever: Retriever | null = null;

export const getRetriever = () => (retriever ??= new Retriever(data.chunks as EmbeddedChunk[]));
export const corpusInfo = () => ({
  model: data.model,
  dims: data.dims,
  chunks: data.chunks.length,
  withVectors: data.chunks.filter((c) => c.embedding).length,
});
