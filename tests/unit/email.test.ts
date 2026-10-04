import { describe, expect, it } from "vitest";
import { profile } from "@/content/profile";
import { canAutoReply, esc, firstName, istStamp, ownerEmail, visitorEmail } from "@/lib/email/templates";

const NOW = new Date("2026-10-04T05:12:00Z"); // 10:42 IST
const sub = {
  name: "Priya Sharma",
  email: "priya@example.com",
  org: "Acme Labs",
  message: "Hi Vishal,\nWe have an SDE role.\n\nCan we talk?",
};

describe("owner email (what Vishal receives)", () => {
  const m = ownerEmail(sub, NOW);
  it("keeps the subject the same as before and shows who, when and the message", () => {
    expect(m.subject).toBe("Portfolio message from Priya Sharma (Acme Labs)");
    expect(m.html).toContain("New message from Priya");
    expect(m.html).toContain("4 Oct 2026, 10:42 IST");
    expect(m.html).toContain("Acme Labs");
    expect(m.html).toContain("Hi Vishal,<br>We have an SDE role.<br><br>Can we talk?");
  });
  it("has a one-tap reply to the visitor, with the subject filled in", () => {
    expect(m.html).toContain(
      `mailto:priya@example.com?subject=${encodeURIComponent("Re: Portfolio message from Priya Sharma (Acme Labs)")}`,
    );
    expect(m.text).toContain("Sent: 4 Oct 2026, 10:42 IST");
    expect(m.text).toContain("We have an SDE role.");
  });
  it("wears the site's theme: dark GitHub palette, one green accent, contribution squares, and no gradients, images or web fonts", () => {
    for (const c of ["#0d1117", "#161b22", "#3fb950", "#39d353", "#26a641"]) expect(m.html).toContain(c);
    expect(m.html).not.toMatch(/gradient|<img|@font-face|url\(/i);
    expect(m.html).toContain('name="color-scheme"');
    expect((m.html.match(/<td width="14"/g) ?? []).length).toBeGreaterThanOrEqual(20); // the square row
  });
  it("omits the company row when there is none", () => {
    expect(ownerEmail({ ...sub, org: "" }, NOW).html).not.toContain("Role / company");
    expect(ownerEmail({ ...sub, org: null }, NOW).subject).toBe("Portfolio message from Priya Sharma");
  });
});

describe("visitor email (confirmation)", () => {
  const m = visitorEmail(sub);
  it("thanks them by first name, quotes what they sent and points to the right places", () => {
    expect(m.subject).toBe("Got your message, Priya");
    expect(m.html).toContain("Got your message, Priya.");
    expect(m.html).toContain("We have an SDE role.");
    expect(m.html).toContain(profile.contact.email);
    expect(m.html).toContain("/resume.pdf");
    expect(m.html).toContain(profile.contact.github);
    expect(m.html).toContain(profile.contact.linkedin);
    expect(m.html).toContain(profile.status); // availability comes from profile.ts, not from this file
    expect(m.text).toContain("You're getting this once");
  });
  it("is themed the same way", () => {
    for (const c of ["#0d1117", "#161b22", "#3fb950"]) expect(m.html).toContain(c);
    expect(m.html).not.toMatch(/gradient|<img|@font-face/i);
  });
});

describe("what a visitor types can't break out of the email", () => {
  const evil = {
    name: `<script>alert(1)</script>Eve\r\nBcc: x@y.z`,
    email: "eve@example.com",
    org: `"><img src=x onerror=alert(2)>`,
    message: `<b>bold</b> & <a href="javascript:alert(3)">click</a>\n<style>body{display:none}</style>`,
  };
  for (const [which, m] of [
    ["owner", ownerEmail(evil, NOW)],
    ["visitor", visitorEmail(evil)],
  ] as const) {
    it(`${which}: everything typed is escaped; a name can't add headers`, () => {
      expect(m.html).not.toMatch(/<script|<img src=x|<b>bold|<a href="javascript|<style>body/);
      expect(m.html).toContain("&lt;script&gt;");
      expect(m.subject).not.toMatch(/[\r\n]/);
      expect(m.subject).not.toContain("<");
    });
  }
  it("esc escapes the five HTML-significant characters", () => {
    expect(esc(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
  });
});

describe("helpers", () => {
  it("first names", () => {
    expect(firstName("Priya Sharma")).toBe("Priya");
    expect(firstName("  Madonna ")).toBe("Madonna");
    expect(firstName("A".repeat(200))).toHaveLength(40);
  });
  it("IST stamps are deterministic across the day boundary", () => {
    expect(istStamp(new Date("2026-12-31T20:30:00Z"))).toBe("1 Jan 2027, 02:00 IST");
  });
  it("auto-reply needs a sender on a verified domain, never the shared one", () => {
    expect(canAutoReply(undefined)).toBe(false);
    expect(canAutoReply("")).toBe(false);
    expect(canAutoReply("Portfolio contact <onboarding@resend.dev>")).toBe(false);
    expect(canAutoReply("Vishal <hello@vishalbg.dev>")).toBe(true);
  });
});
