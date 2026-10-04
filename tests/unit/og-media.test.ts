import { describe, expect, it } from "vitest";
import { ogImageFor } from "@/lib/seo/og-media";

describe("case-study social cards", () => {
  it("use the real capture as a small JPEG for projects that have one", async () => {
    for (const slug of ["golden-verdict", "talnio", "virtual-tour"]) {
      const url = await ogImageFor(slug);
      expect(url, slug).toMatch(/^data:image\/jpeg;base64,/);
      const bytes = Buffer.from(url!.split(",")[1]!, "base64");
      expect(bytes.subarray(0, 3).toString("hex"), `${slug} is a JPEG`).toBe("ffd8ff");
      expect(bytes.length, slug).toBeGreaterThan(5_000);
      expect(bytes.length, slug).toBeLessThan(150_000);
    }
  });

  it("keep the text-only card where the hero is a drawing (LanSymphony has no public UI) or the project is unknown", async () => {
    expect(await ogImageFor("lansymphony")).toBeNull();
    expect(await ogImageFor("nope")).toBeNull();
  });
});
