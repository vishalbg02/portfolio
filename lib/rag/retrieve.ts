import { Bm25Index } from "./bm25";
import { synonymsOf, tokenize } from "./text";
import type { EmbeddedChunk, Retrieved } from "./types";

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

const RRF_K = 60;

/**
 * Best-chunk cosine similarity at or above which a question counts as "about Vishal".
 * Calibrated 2026-10-03 with gemini-embedding-001 @ 768 dims on 11 on-topic and 8 off-topic questions:
 * on-topic best scores were 0.611–0.753, off-topic 0.505–0.585 (poem, weather, code, injection, trivia).
 * Re-measure if the embedding model or corpus changes.
 */
export const VECTOR_RELEVANT = 0.6;
/** Below this coverage a question is treated as unrelated: no model call, polite canned answer. */
export const RELEVANCE_MIN = 0.4;
/** Keyword hits scoring below this share of the best hit are discarded. */
const FLOOR = 0.35;
const KEEP_TOP = 3;
/** Stemmed words that mean "evaluate him overall" rather than "find a specific fact". */
/** Raw-text check (stemming would turn "working" into "work", which also means "work experience"). */
const STATUS_QUESTION =
  /\b(currently|current|presently|right now|now|today|working|works|employed|employer|workplace|available|availability|latest|most recent)\b/i;
const INTENT_WORDS = [
  "fit",
  "suitable",
  "hire",
  "hiring",
  "qualified",
  "strength",
  "recruit",
  "candidate",
  "good",
  "best",
  "strongest",
  "expertise",
  "specialize",
  "specialty",
  "speciality",
];

export type RetrievalResult = {
  results: Retrieved[];
  /** "hybrid" = BM25 + vectors, "keyword" = BM25 only. */
  mode: "hybrid" | "keyword";
  /** Share of the query's meaningful words found in the best chunk (0–1). Low ⇒ probably off-topic. */
  coverage: number;
};

export class Retriever {
  private bm25: Bm25Index;

  constructor(private readonly chunks: EmbeddedChunk[]) {
    this.bm25 = new Bm25Index(chunks);
  }

  /** All chunks (used by the job-description matcher, which does its own literal matching). */
  chunkList(): EmbeddedChunk[] {
    return this.chunks;
  }

  get hasVectors(): boolean {
    return this.chunks.some((c) => c.embedding && c.embedding.length > 0);
  }

  /**
   * Top-k chunks. With a query embedding (and vectors on the chunks) BM25 and cosine rankings are fused
   * by reciprocal rank fusion; otherwise BM25 alone.
   */
  retrieve(query: string, k = 5, queryEmbedding?: number[] | null): RetrievalResult {
    const found = this.bm25.search(query);
    const best = found.hits[0];
    // Always keep the top few (broad questions need breadth); drop a weak long tail beyond them.
    const hits = found.hits.filter((h, i) => i < KEEP_TOP || !best || h.score >= best.score * FLOOR);
    const queryWords = new Set(tokenize(query));
    const coverage =
      best && queryWords.size > 0
        ? [...queryWords].filter((w) => {
            const doc = this.bm25Doc(best.index);
            return doc.has(w) || synonymsOf(w).some((s) => doc.has(s));
          }).length / queryWords.size
        : 0;

    if (queryEmbedding && this.hasVectors) {
      const vec = this.chunks
        .map((c, index) => ({ index, score: c.embedding ? cosine(queryEmbedding, c.embedding) : -1 }))
        .filter((h) => h.score > 0)
        .sort((a, b) => b.score - a.score);
      const fused = new Map<number, number>();
      hits
        .slice(0, 20)
        .forEach((h, r) => fused.set(h.index, (fused.get(h.index) ?? 0) + 1 / (RRF_K + r + 1)));
      vec.slice(0, 20).forEach((h, r) => fused.set(h.index, (fused.get(h.index) ?? 0) + 1 / (RRF_K + r + 1)));
      const ranked = [...fused].sort((a, b) => b[1] - a[1]).slice(0, k);
      const topVec = vec[0]?.score ?? 0;
      return {
        mode: "hybrid",
        // a strong semantic match counts as relevant even when few literal words overlap
        coverage: Math.max(coverage, topVec >= VECTOR_RELEVANT ? 1 : 0),
        results: this.pinEntities(
          query,
          ranked.map(([index, score]) => ({ chunk: this.chunks[index]!, score })),
        )
          .slice(0, k)
          .map((r, i) => ({ ...r, rank: i + 1 })),
      };
    }

    const ranked = hits.map((h) => ({ chunk: this.chunks[h.index]!, score: h.score }));
    return {
      mode: "keyword",
      coverage,
      results: this.pinEntities(query, ranked)
        .slice(0, k)
        .map((r, i) => ({ ...r, rank: i + 1 })),
    };
  }

  /**
   * "Tell me about Golden Verdict" should lead with the project overview, not whichever case-study
   * paragraph scored highest: if the question names a project, its overview chunk goes first.
   */
  private pinEntities<T extends { chunk: EmbeddedChunk; score: number }>(query: string, ranked: T[]): T[] {
    ranked = this.addIntentChunks(query, ranked);
    const q = query.toLowerCase();
    const pinned = this.chunks.filter(
      (c) => c.id.startsWith("project-") && q.includes(c.title.split(" — ")[0]!.toLowerCase()),
    );
    if (pinned.length === 0) return ranked;
    const ids = new Set(pinned.map((c) => c.id));
    const first = pinned.map(
      (chunk) => ranked.find((r) => r.chunk.id === chunk.id) ?? ({ chunk, score: 0 } as T),
    );
    return [...first, ...ranked.filter((r) => !ids.has(r.chunk.id))];
  }

  /**
   * Broad "is he a fit / why hire him / strengths" questions have no distinctive keywords, so keyword
   * search latches onto noise ("role-based"). Give them the overview + experience chunks right
   * after the best hit. (With vectors, semantic search makes this unnecessary.)
   */
  private addIntentChunks<T extends { chunk: EmbeddedChunk; score: number }>(
    query: string,
    ranked: T[],
  ): T[] {
    const words = new Set(tokenize(query));
    if (STATUS_QUESTION.test(query)) {
      const status = this.chunks.find((c) => c.id === "status");
      if (status) {
        const rest = ranked.filter((r) => r.chunk.id !== "status");
        const hit = ranked.find((r) => r.chunk.id === "status");
        return [hit ?? ({ chunk: status, score: 0 } as T), ...rest];
      }
    }
    if (!INTENT_WORDS.some((w) => words.has(w))) return ranked;
    const want = ["about", "experience-0", "experience-1", "skills-backend", "skills-frontend"];
    const have = new Set(ranked.map((r) => r.chunk.id));
    const extra = want
      .filter((id) => !have.has(id))
      .map((id) => this.chunks.find((c) => c.id === id))
      .filter((c): c is EmbeddedChunk => Boolean(c))
      .map((chunk) => ({ chunk, score: 0 }) as T);
    const aboutFirst = ranked.filter((r) => r.chunk.id === "about");
    const rest = ranked.filter((r) => r.chunk.id !== "about");
    return [...aboutFirst, ...extra.slice(0, 3), ...rest];
  }

  private docCache = new Map<number, Set<string>>();
  private bm25Doc(index: number): Set<string> {
    let s = this.docCache.get(index);
    if (!s) {
      const c = this.chunks[index]!;
      s = new Set([...tokenize(c.title), ...tokenize(c.text)]);
      this.docCache.set(index, s);
    }
    return s;
  }
}
