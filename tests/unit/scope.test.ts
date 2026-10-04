import { describe, expect, it } from "vitest";
import { validateChatRequest } from "@/lib/ai/guards";
import { belongsToProject, scopeResults } from "@/lib/rag/scope";
import { getRetriever } from "@/lib/rag/store";
import type { Chunk, Retrieved } from "@/lib/rag/types";

const chunk = (id: string): Chunk => ({ id, title: id, url: `/#${id}`, text: id });
const hit = (id: string, rank: number): Retrieved => ({ chunk: chunk(id), score: 1 / rank, rank });

describe("scopeResults", () => {
  const all = [
    "about",
    "project-talnio",
    "case-talnio-the-problem",
    "project-golden-verdict",
    "skills-backend",
  ].map(chunk);
  it("knows which chunks belong to a project", () => {
    expect(belongsToProject(chunk("project-talnio"), "talnio")).toBe(true);
    expect(belongsToProject(chunk("case-talnio-architecture-nodes"), "talnio")).toBe(true);
    expect(belongsToProject(chunk("case-talnio2-x"), "talnio")).toBe(false);
    expect(belongsToProject(chunk("project-golden-verdict"), "talnio")).toBe(false);
  });
  it("puts the project's chunks first and keeps the others in order", () => {
    const res = scopeResults(
      [hit("about", 1), hit("skills-backend", 2), hit("case-talnio-the-problem", 3)],
      "talnio",
      all,
    );
    expect(res.map((r) => r.chunk.id)).toEqual(["case-talnio-the-problem", "about", "skills-backend"]);
    expect(res.map((r) => r.rank)).toEqual([1, 2, 3]);
  });
  it("pulls in the project overview when retrieval found nothing about it", () => {
    const res = scopeResults([hit("about", 1), hit("skills-backend", 2)], "talnio", all);
    expect(res[0]!.chunk.id).toBe("project-talnio");
    expect(res).toHaveLength(3);
  });
  it("works against the real corpus for every project", () => {
    const chunks = getRetriever().chunkList();
    for (const slug of ["golden-verdict", "talnio", "lansymphony", "virtual-tour"]) {
      const res = scopeResults([], slug, chunks);
      expect(res[0]!.chunk.id).toBe(`project-${slug}`);
    }
  });
});

describe("chat request project scope", () => {
  const body = (project?: unknown) => ({ messages: [{ role: "user", content: "hi" }], project });
  it("accepts a known project slug and passes it on", () => {
    const v = validateChatRequest(body("talnio"));
    expect(v).toMatchObject({ ok: true, project: "talnio" });
  });
  it("is optional", () => {
    expect(validateChatRequest(body())).toMatchObject({ ok: true, project: undefined });
  });
  it("rejects anything that isn't a project slug", () => {
    expect(validateChatRequest(body("../../etc/passwd"))).toMatchObject({ ok: false, status: 400 });
    expect(validateChatRequest(body(7))).toMatchObject({ ok: false, status: 400 });
  });
});
