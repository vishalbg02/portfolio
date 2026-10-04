import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import { profile } from "@/content/profile";
import { qrMatrix, qrPath, qrSize } from "@/lib/contact/qr";
import { VCARD_PATH, buildVCard, fold } from "@/lib/contact/vcard";
import { monogram } from "@/lib/content/monogram";

describe("vCard", () => {
  const card = buildVCard(profile, "https://example.test");
  const lines = card.split("\r\n");

  it("is a vCard 3.0 with CRLF line ends, and only what the profile says", () => {
    expect(lines[0]).toBe("BEGIN:VCARD");
    expect(lines[1]).toBe("VERSION:3.0");
    expect(lines.at(-2)).toBe("END:VCARD");
    expect(lines.at(-1)).toBe("");
    expect(card).not.toMatch(/(?<!\r)\n/); // no bare line feeds
    expect(card).toContain(`FN:${profile.name}`);
    expect(card).toContain("N:B G;Vishal;;;");
    expect(card).toContain(`TITLE:${profile.shortRole}`);
    expect(card).toContain("TEL;TYPE=CELL:+919663972259");
    expect(card).toContain(`EMAIL;TYPE=INTERNET:${profile.contact.email}`);
    expect(card).toContain("URL:https://example.test");
    expect(card).toContain(`URL:${profile.contact.linkedin}`);
    expect(card).toContain(`URL:${profile.contact.github}`);
    expect(card).toContain("ADR:;;;Bengaluru;;;India");
  });

  it("has no empty fields and nothing the profile does not state (no birthday, org or address lines)", () => {
    for (const l of lines.filter(Boolean)) expect(l).not.toMatch(/:$/);
    for (const key of ["BDAY", "ORG", "PHOTO", "NOTE", "GEO"]) expect(card).not.toContain(`\r\n${key}`);
  });

  it("folds long lines at 75 characters and escapes the special characters", () => {
    const long = `NOTE:${"x".repeat(200)}`;
    const folded = fold(long).split("\r\n");
    expect(folded[0]).toHaveLength(75);
    for (const l of folded.slice(1)) {
      expect(l.startsWith(" ")).toBe(true);
      expect(l.length).toBeLessThanOrEqual(75);
    }
    expect(folded.map((l, i) => (i ? l.slice(1) : l)).join("")).toBe(long);
    expect(buildVCard({ ...profile, name: "A, B; C" }, "https://x.test")).toContain("FN:A\\, B\; C");
  });

  it("is served from a stable path", () => {
    expect(VCARD_PATH).toBe("/vishal-b-g.vcf");
  });
});

describe("QR code", () => {
  const finder = (m: boolean[][], r0: number, c0: number) => {
    // a finder pattern: 7x7 dark ring, 5x5 light ring, 3x3 dark centre
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 7; c++) {
        const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
        expect(m[r0 + r]![c0 + c], `(${r0 + r},${c0 + c})`).toBe(ring !== 2);
      }
  };

  it("has the three finder patterns every scanner locks on to, and is square", () => {
    const m = qrMatrix("https://vishalbg.vercel.app/vishal-b-g.vcf");
    const n = m.length;
    expect(m.every((row) => row.length === n)).toBe(true);
    expect((n - 17) % 4).toBe(0); // 21, 25, 29 … modules
    finder(m, 0, 0);
    finder(m, 0, n - 7);
    finder(m, n - 7, 0);
  });

  it("is deterministic and grows with the text", () => {
    const a = qrMatrix("https://vishalbg.vercel.app/vishal-b-g.vcf");
    expect(qrMatrix("https://vishalbg.vercel.app/vishal-b-g.vcf")).toEqual(a);
    expect(qrMatrix("x".repeat(120)).length).toBeGreaterThan(a.length);
  });

  it("draws exactly the dark modules in one small path", () => {
    const m = qrMatrix("https://vishalbg.vercel.app/vishal-b-g.vcf");
    const path = qrPath(m);
    expect(path).toMatch(/^(M\d+ \d+h\d+v1h-\d+z)+$/);
    const dark = m.flat().filter(Boolean).length;
    const drawn = [...path.matchAll(/h(\d+)v1/g)].reduce((s, x) => s + Number(x[1]), 0);
    expect(drawn).toBe(dark);
    expect(path.length).toBeLessThan(4_000);
    expect(qrSize(m)).toBe(m.length + 8);
  });
});

describe("QR code, read back", () => {
  it("decodes to exactly the address it was made from (dark modules on a light tile, quiet zone included)", () => {
    const url = "https://vishalbg.vercel.app/vishal-b-g.vcf";
    const m = qrMatrix(url);
    const scale = 6;
    const side = qrSize(m) * scale;
    const px = new Uint8ClampedArray(side * side * 4).fill(255); // a white tile
    m.forEach((row, r) =>
      row.forEach((dark, c) => {
        if (!dark) return;
        for (let y = 0; y < scale; y++)
          for (let x = 0; x < scale; x++) {
            const i = (((r + 4) * scale + y) * side + (c + 4) * scale + x) * 4;
            px[i] = px[i + 1] = px[i + 2] = 13; // #0d1117
          }
      }),
    );
    expect(jsQR(px, side, side)?.data).toBe(url);
  });
});

describe("monogram", () => {
  it("gives two letters for each employer on the page, ignoring brackets and legal suffixes", () => {
    expect(profile.experience.map((e) => monogram(e.company))).toEqual(["GV", "SA", "KT"]);
    expect(monogram("Acme")).toBe("AC");
    expect(monogram("(Cove IoT)")).toBe("?");
    expect(monogram("Tata Consultancy Services Ltd.")).toBe("TC");
  });
});
