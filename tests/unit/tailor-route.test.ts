import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { post } from "./helpers/ai";

beforeEach(() => vi.spyOn(console, "info").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

async function load() {
  vi.resetModules();
  return import("@/app/api/resume/tailor/route");
}
const send = (body: unknown, ip = "7.7.7.7", headers: Record<string, string> = {}) =>
  post("/api/resume/tailor", body, { "x-forwarded-for": ip, ...headers });
const REQS = [
  { skill: "Spring Boot", importance: "high" },
  { skill: "Java", importance: "high" },
  { skill: "Docker", importance: "low" },
];

describe("POST /api/resume/tailor", () => {
  it("returns a one-page PDF named after the role, as a download", async () => {
    const { POST } = await load();
    const res = await POST(send({ requirements: REQS, role: "Backend Engineer" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="Vishal_BG_Resume_BackendEngineer.pdf"',
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    // one page: the same check the résumé build uses
    const pages =
      Buffer.from(bytes)
        .toString("latin1")
        .match(/\/Type\s*\/Page\b(?!s)/g) ?? [];
    expect(pages).toHaveLength(1);
  });

  it("answers with what would change (and no file) when asked for the summary", async () => {
    const { POST } = await load();
    const res = await POST(send({ requirements: REQS, format: "summary" }));
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body.summary).toMatchObject({
      movedUp: expect.any(Array),
      emphasised: expect.any(Array),
      gaps: expect.any(Array),
    });
    expect(body.summary.gaps).toContain("Docker");
    expect(body.filename).toBe("Vishal_BG_Resume_Tailored.pdf");
  });

  it("the PDF text contains only things the standard résumé says (it re-orders, never writes)", async () => {
    const { POST } = await load();
    const tailored = Buffer.from(await (await POST(send({ requirements: REQS }))).arrayBuffer());
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { ResumeDocument } = await import("@/lib/resume/ResumeDocument");
    const { buildResumeModel } = await import("@/lib/resume/model");
    const React = await import("react");
    const standard = Buffer.from(
      await renderToBuffer(React.createElement(ResumeDocument, { model: buildResumeModel() }) as never),
    );
    // same page count and (within a few percent) the same size: the content is the same, only reordered
    const ratio = tailored.length / standard.length;
    expect(ratio).toBeGreaterThan(0.9);
    expect(ratio).toBeLessThan(1.1);
  });

  it.each([
    ["no requirements", { requirements: [] }],
    [
      "too many requirements",
      { requirements: Array.from({ length: 40 }, (_, i) => ({ skill: `s${i}`, importance: "low" })) },
    ],
    ["a skill that is too long", { requirements: [{ skill: "x".repeat(100), importance: "high" }] }],
    ["an unknown importance", { requirements: [{ skill: "Java", importance: "critical" }] }],
    ["a role with markup", { requirements: REQS, role: "<script>alert(1)</script>" }],
    ["a role that is too long", { requirements: REQS, role: "r".repeat(61) }],
    ["an unknown format", { requirements: REQS, format: "docx" }],
  ])("refuses %s", async (_n, body) => {
    const { POST } = await load();
    expect((await POST(send(body))).status).toBe(400);
  });

  it("refuses bad JSON, a huge body and another site", async () => {
    const { POST } = await load();
    expect((await POST(post("/api/resume/tailor", "{nope", { "x-forwarded-for": "7.7.7.8" }))).status).toBe(
      400,
    );
    expect(
      (await POST(send({ requirements: REQS, role: "a", pad: "x".repeat(5000) }, "7.7.7.8"))).status,
    ).toBe(413);
    expect(
      (await POST(send({ requirements: REQS }, "7.7.7.9", { origin: "https://evil.example" }))).status,
    ).toBe(403);
  });

  it("limits each client to 8 résumés in 10 minutes", async () => {
    const { POST } = await load();
    for (let i = 0; i < 8; i++)
      expect((await POST(send({ requirements: REQS, format: "summary" }, "8.8.8.8"))).status).toBe(200);
    const blocked = await POST(send({ requirements: REQS, format: "summary" }, "8.8.8.8"));
    expect(blocked.status).toBe(429);
    expect((await POST(send({ requirements: REQS, format: "summary" }, "8.8.8.9"))).status).toBe(200);
  });
});
