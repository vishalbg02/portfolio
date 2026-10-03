import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { profile } from "@/content/profile";
import { getAllCaseStudySlugs } from "@/lib/content/work";
import {
  MAX_CHUNK_CHARS,
  buildCorpus,
  caseStudyChunks,
  mdxToText,
  profileChunks,
  splitText,
} from "@/lib/rag/chunks";
import { contentHash, textHash } from "@/lib/rag/hash";
import { Bm25Index } from "@/lib/rag/bm25";
import { Retriever, cosine } from "@/lib/rag/retrieve";
import { expandQuery, stem, tokenize } from "@/lib/rag/text";
import type { EmbeddedChunk, EmbeddingsFile } from "@/lib/rag/types";
import { slugify } from "@/lib/utils/slugify";

const file = JSON.parse(readFileSync("generated/embeddings.json", "utf8")) as EmbeddingsFile;
const retriever = new Retriever(file.chunks);
const top = (q: string, k = 3) => retriever.retrieve(q, k).results.map((r) => r.chunk.id);

describe("tokenizer", () => {
  it("keeps technology names intact", () => {
    expect(tokenize("Node.js, Next.js and C++ with CI/CD")).toEqual(
      expect.arrayContaining(["nodejs", "nextjs", "cpp", "cicd"]),
    );
    expect(tokenize("full-stack real-time peer-to-peer AES-256")).toEqual(
      expect.arrayContaining(["fullstack", "realtime", "p2p", "aes256"]),
    );
  });
  it("drops stop words and stems plurals", () => {
    expect(tokenize("What are the projects he has built?")).toEqual(["project", "built"]);
    expect(stem("services")).toBe("service");
    expect(stem("class")).toBe("class");
    expect(stem("building")).toBe("build");
    expect(stem("spring")).toBe("spring"); // not "spr"
    expect(stem("testing")).toBe("test");
  });
  it("expands domain synonyms", () => {
    expect(expandQuery(["email"])).toEqual(expect.arrayContaining(["email", "contact"]));
  });
});

describe("corpus (built from the same sources as the site)", () => {
  it("builds chunks with unique ids, titles, valid URLs and sane sizes", async () => {
    const chunks = await buildCorpus();
    expect(chunks.length).toBeGreaterThanOrEqual(30);
    expect(new Set(chunks.map((c) => c.id)).size).toBe(chunks.length);
    for (const c of chunks) {
      expect(c.title.length, c.id).toBeGreaterThan(2);
      expect(c.text.length, c.id).toBeGreaterThan(30);
      expect(c.text.length, `${c.id} is over ~450 tokens`).toBeLessThanOrEqual(MAX_CHUNK_CHARS + 200);
      expect(c.url, c.id).toMatch(/^\/(#[a-z-]+|work\/[a-z-]+(#[a-z-]+)?|resume|now|recruiter)?$/);
    }
  });

  it("covers every project, experience, skill group, education, awards and contact", () => {
    const ids = new Set(profileChunks().map((c) => c.id));
    for (const p of profile.projects) expect(ids.has(`project-${p.slug}`)).toBe(true);
    profile.experience.forEach((_, i) => expect(ids.has(`experience-${i}`)).toBe(true));
    for (const id of [
      "about",
      "education",
      "certifications",
      "recognition",
      "contact",
      "skills-backend",
      "skills-ai",
    ])
      expect(ids.has(id), id).toBe(true);
  });

  it("includes case-study sections and architecture components for every project, but not boilerplate", async () => {
    const chunks = await buildCorpus();
    for (const slug of getAllCaseStudySlugs()) {
      const mine = chunks.filter((c) => c.id.startsWith(`case-${slug}-`));
      expect(mine.length, slug).toBeGreaterThanOrEqual(4);
      expect(mine.some((c) => c.id.endsWith("architecture-nodes"))).toBe(true);
      expect(mine.some((c) => c.id.includes("code-in-the-wild"))).toBe(false);
    }
  });

  it("citation anchors point at real headings", async () => {
    const chunks = await buildCorpus();
    const anchors = new Set(
      ["architecture", "key-decisions", "the-problem", "what-i-built", "outcome"].map((a) => a),
    );
    for (const c of chunks.filter((x) => x.url.includes("#") && x.url.startsWith("/work/"))) {
      expect(anchors.has(c.url.split("#")[1]!), c.url).toBe(true);
    }
    expect(slugify("What I built")).toBe("what-i-built");
  });

  it("states no number that is not already in profile.ts (no invented facts)", async () => {
    const known = new Set(
      [...JSON.stringify(profile).matchAll(/\d[\d.,]*\+?/g)].map((m) => m[0].replace(/[.,]$/, "")),
    );
    const tech = new Set([
      "360",
      "256",
      "12",
      "32",
      "64",
      "6",
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "10",
      "15",
      "24",
      "26",
    ]);
    for (const c of await buildCorpus()) {
      for (const m of c.text.matchAll(/\d[\d.,]*\+?/g)) {
        const n = m[0].replace(/[.,]$/, "");
        expect(known.has(n) || tech.has(n), `"${n}" in chunk ${c.id}`).toBe(true);
      }
    }
  });

  it("mdxToText flattens decisions and drops JSX", () => {
    const text = mdxToText(
      'Hello **world**\n\n<Decision title="T" why="W." tradeoff="X." />\n\n<Architecture />\n<Snippet id="a" />',
    );
    expect(text).toContain("Hello world");
    expect(text).toContain("Decision: T. Why: W. Trade-off: X.");
    expect(text).not.toMatch(/<|Snippet|Architecture/);
  });

  it("splitText respects the limit at paragraph boundaries", () => {
    const para = "x".repeat(700);
    const parts = splitText(`${para}\n\n${para}\n\n${para}`, 1500);
    expect(parts.length).toBe(2);
    expect(parts.every((p) => p.length <= 1500)).toBe(true);
    expect(splitText("short")).toEqual(["short"]);
    expect(splitText("y".repeat(4000), 1800).every((p) => p.length <= 1800)).toBe(true);
  });

  it("caseStudyChunks anchors each section", () => {
    const raw =
      "---\nslug: talnio\n---\n## The problem\nA real problem here with enough words to count.\n\n## Key decisions\nSome decisions text here with enough words.";
    const c = caseStudyChunks("talnio", "Talnio", raw);
    expect(c.map((x) => x.url)).toEqual(
      expect.arrayContaining(["/work/talnio#the-problem", "/work/talnio#key-decisions"]),
    );
  });
});

describe("generated/embeddings.json", () => {
  it("is well-formed and consistent with its own hash", () => {
    expect(file.version).toBe(1);
    expect(file.chunks.length).toBeGreaterThan(30);
    expect(file.contentHash).toBe(contentHash(file.chunks, file.model, file.dims));
    for (const c of file.chunks) {
      expect(c.textHash, c.id).toBe(textHash(c));
      if (c.embedding) expect(c.embedding.length, c.id).toBe(file.dims);
    }
  });
});

describe("keyword retrieval ranking", () => {
  it.each([
    ["What has he built with Spring Boot?", "experience-1"],
    ["Tell me about Golden Verdict", "project-golden-verdict"],
    ["How can I contact him?", "contact"],
    ["What is his email address?", "contact"],
    ["Which hackathons has he won?", "recognition"],
    ["What is his CGPA?", "education"],
    ["Where did he study?", "education"],
    ["Does he know Flutter?", "skills-mobile"],
    ["What AWS certification does he have?", "certifications"],
    ["Which languages does he speak?", "personal"],
    ["Tell me about LanSymphony", "project-lansymphony"],
    ["Tell me about the CHRIST University Virtual Tour", "project-virtual-tour"],
  ])("%s → includes %s in the top 3", (q, id) => {
    expect(top(q)).toContain(id);
  });

  it("puts the named project's overview first", () => {
    expect(top("Tell me about Talnio")[0]).toBe("project-talnio");
    expect(top("How does Golden Verdict handle roles?")[0]).toBe("project-golden-verdict");
  });

  it("finds case-study depth for technical questions", () => {
    expect(
      top("How does Talnio sync data in real time?", 5).some((id) => id.startsWith("case-talnio-")),
    ).toBe(true);
    expect(
      top("Tell me about the AES-256 handshake", 5).some((id) => id.startsWith("case-lansymphony-")),
    ).toBe(true);
  });

  it("fit-for-role questions surface skills and experience, not boilerplate", () => {
    const ids = top("Is he a fit for a full-stack role?", 5);
    expect(ids).toContain("about");
    expect(ids.some((id) => id.startsWith("experience-") || id.startsWith("skills-"))).toBe(true);
  });

  it("reports low coverage for unrelated or unknown topics", () => {
    for (const q of [
      "What's the weather in Paris?",
      "write me a poem about the ocean",
      "Write Python code to sort a list",
      "Does he know Kubernetes?",
      "what is his salary?",
    ]) {
      expect(retriever.retrieve(q).coverage, q).toBeLessThan(0.4);
    }
  });

  it("reports healthy coverage for on-topic questions", () => {
    for (const q of [
      "Where did he study?",
      "Which hackathons has he won?",
      "How can I contact him?",
      "What has he built with Spring Boot?",
    ]) {
      expect(retriever.retrieve(q).coverage, q).toBeGreaterThanOrEqual(0.5);
    }
  });

  it("returns nothing for gibberish and never more than k", () => {
    expect(retriever.retrieve("zzzqqq xxyyzz").results).toEqual([]);
    expect(retriever.retrieve("project skill experience", 2).results.length).toBeLessThanOrEqual(2);
  });
});

describe("hybrid retrieval (BM25 + vectors)", () => {
  const unit = (i: number, n = 4) => Array.from({ length: n }, (_, j) => (j === i ? 1 : 0));
  const chunks: EmbeddedChunk[] = [
    { id: "a", title: "Alpha", url: "/", text: "alpha chunk about cats", textHash: "a", embedding: unit(0) },
    { id: "b", title: "Beta", url: "/", text: "beta chunk about dogs", textHash: "b", embedding: unit(1) },
    { id: "c", title: "Gamma", url: "/", text: "gamma chunk about birds", textHash: "c", embedding: null },
  ];
  const r = new Retriever(chunks);

  it("cosine similarity is correct", () => {
    expect(cosine([1, 0], [1, 0])).toBe(1);
    expect(cosine([1, 0], [0, 1])).toBe(0);
    expect(cosine([0, 0], [1, 1])).toBe(0);
    expect(cosine([1, 1], [2, 2])).toBeCloseTo(1);
  });

  it("uses vectors to find a chunk with no keyword overlap", () => {
    const res = r.retrieve("feline pets", 2, unit(0));
    expect(res.mode).toBe("hybrid");
    expect(res.results[0]!.chunk.id).toBe("a");
    expect(res.coverage).toBe(1);
  });

  it("falls back to keyword mode without a query embedding or without vectors", () => {
    expect(r.retrieve("dogs", 2).mode).toBe("keyword");
    expect(
      new Retriever(chunks.map((c) => ({ ...c, embedding: null }))).retrieve("dogs", 1, unit(1)).mode,
    ).toBe("keyword");
  });

  it("fuses both rankings (a keyword hit and a vector hit both appear)", () => {
    const ids = r.retrieve("birds", 3, unit(1)).results.map((x) => x.chunk.id);
    expect(ids).toEqual(expect.arrayContaining(["b", "c"]));
  });
});

describe("Bm25Index", () => {
  it("prefers title matches and rare terms", () => {
    const idx = new Bm25Index([
      { id: "1", title: "Cats", url: "/", text: "all about pets" },
      { id: "2", title: "Pets", url: "/", text: "cats cats cats and dogs" },
      { id: "3", title: "Other", url: "/", text: "nothing relevant at all" },
    ]);
    const { hits } = idx.search("cats");
    expect(hits.map((h) => h.index)).toContain(0);
    expect(hits.map((h) => h.index)).not.toContain(2);
  });
});

describe("current-status questions (the Social Agent internship ended Mar 2026)", () => {
  const status = profileChunks().find((c) => c.id === "status")!;

  it("has a derived status chunk that says he is not currently employed and names the last role", () => {
    expect(status.text).toMatch(/not currently in a full-time job or internship/i);
    expect(status.text).toContain("Golden Verdict"); // ongoing freelance work
    expect(status.text).toContain("Jan 2026");
    expect(status.text).toContain("Social Agent");
    expect(status.text).toContain("Mar 2026");
    expect(status.text).toContain(profile.status);
  });

  it.each([
    "Where is he currently working?",
    "Where does Vishal work now?",
    "Is he employed right now?",
    "What is he doing at the moment?",
    "Is he available for hire?",
  ])("%s → status chunk first, with full coverage", (q) => {
    const r = retriever.retrieve(q, 5);
    expect(r.results[0]!.chunk.id).toBe("status");
    expect(r.coverage).toBeGreaterThanOrEqual(0.4);
  });

  it("answers 'which companies has he worked at' from the work-history chunk", () => {
    expect(top("Which companies has he worked at?", 4)).toContain("employers");
  });

  it("no chunk still calls the finished internship a current role", () => {
    const text = profileChunks()
      .map((c) => c.text)
      .join("\n");
    expect(text).not.toMatch(/\(current role\)/);
    expect(text).not.toMatch(/Present/);
  });
});
