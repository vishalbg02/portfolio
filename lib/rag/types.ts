export type Chunk = {
  /** Stable id, used to re-attach vectors between runs. */
  id: string;
  title: string;
  /** Page or section the chunk came from — shown as the citation link. */
  url: string;
  text: string;
};

export type EmbeddedChunk = Chunk & {
  /** Hash of title+url+text; vectors are only reused while this is unchanged. */
  textHash: string;
  embedding: number[] | null;
};

export type EmbeddingsFile = {
  version: 1;
  model: string;
  dims: number;
  /** Hash of every chunk (id, url, text) plus model + dims. Used to warn when the file is stale. */
  contentHash: string;
  generatedAt: string;
  chunks: EmbeddedChunk[];
};

export type Retrieved = { chunk: Chunk; score: number; rank: number };
