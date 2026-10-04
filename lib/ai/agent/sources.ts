import type { Chunk } from "@/lib/rag/types";
import type { Source } from "../protocol";

/**
 * The numbered passages an answer may cite. The first retrieval fills [1…k]; a later search_profile call
 * adds more (never renumbering what is already there), so a citation always points at what the model saw.
 */
export class SourceRegistry {
  private items: Array<{ id: string; title: string; url: string; text: string }> = [];

  /** Adds passages (skipping ones already present) and returns them with their numbers. */
  add(chunks: Chunk[]): Array<{ n: number; title: string; url: string; text: string }> {
    return chunks.map((c) => {
      let i = this.items.findIndex((x) => x.id === c.id);
      if (i < 0) {
        this.items.push({ id: c.id, title: c.title, url: c.url, text: c.text });
        i = this.items.length - 1;
      }
      const it = this.items[i]!;
      return { n: i + 1, title: it.title, url: it.url, text: it.text };
    });
  }

  /** Adds a source with no passage text (a card's page), e.g. the case study a project card links to. */
  addLink(id: string, title: string, url: string): number {
    return this.add([{ id, title, url, text: "" }])[0]!.n;
  }

  get size() {
    return this.items.length;
  }

  all(): Source[] {
    return this.items.map((it, i) => ({ n: i + 1, title: it.title, url: it.url }));
  }
}
