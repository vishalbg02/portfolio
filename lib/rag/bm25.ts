import { expandQuery, tokenize } from "./text";
import type { Chunk } from "./types";

const K1 = 1.5;
const B = 0.75;

export type Bm25Hit = { index: number; score: number; matched: number };

/** Minimal BM25 index. Titles count twice. Used on its own when there is no API key or no vectors. */
export class Bm25Index {
  private docs: string[][];
  private df = new Map<string, number>();
  private avgLen: number;

  constructor(private readonly chunks: Chunk[]) {
    this.docs = chunks.map((c) => [...tokenize(c.title), ...tokenize(c.title), ...tokenize(c.text)]);
    for (const d of this.docs) for (const t of new Set(d)) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    this.avgLen = this.docs.reduce((n, d) => n + d.length, 0) / Math.max(1, this.docs.length);
  }

  private idf(term: string): number {
    const n = this.docs.length;
    const df = this.df.get(term) ?? 0;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  /** Returns hits sorted by score. `matched` = how many distinct (expanded) query terms the chunk contains. */
  search(query: string): { hits: Bm25Hit[]; queryTerms: string[] } {
    const base = tokenize(query);
    const terms = expandQuery(base);
    const hits: Bm25Hit[] = [];
    this.docs.forEach((doc, index) => {
      const tf = new Map<string, number>();
      for (const t of doc) tf.set(t, (tf.get(t) ?? 0) + 1);
      let score = 0;
      let matched = 0;
      for (const term of terms) {
        const f = tf.get(term);
        if (!f) continue;
        matched += 1;
        // original query words weigh more than synonym expansions
        const weight = base.includes(term) ? 1 : 0.5;
        score +=
          weight * this.idf(term) * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * doc.length) / this.avgLen)));
      }
      if (score > 0) hits.push({ index, score, matched });
    });
    hits.sort((a, b) => b.score - a.score);
    return { hits, queryTerms: terms };
  }
}
