import { describe, expect, it } from "vitest";
import { LIMITS, mailtoHref, singleLine, validateContact } from "@/lib/contact/rules";
import { ContactSchema, fieldErrors } from "@/lib/contact/schema";

const valid = {
  name: "Asha Rao",
  email: "asha@example.com",
  message: "Hi Vishal, we'd like to talk about a role.",
};

describe("ContactSchema", () => {
  it("accepts a valid message and defaults optional fields", () => {
    const r = ContactSchema.parse(valid);
    expect(r.org).toBe("");
    expect(r.website).toBe("");
  });

  it.each([
    [{ ...valid, name: "A" }, "name"],
    [{ ...valid, email: "nope" }, "email"],
    [{ ...valid, message: "short" }, "message"],
    [{ ...valid, message: "x".repeat(2001) }, "message"],
    [{ ...valid, org: "o".repeat(121) }, "org"],
  ])("rejects %j", (input, field) => {
    const r = ContactSchema.safeParse(input);
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error)[field as "name"]).toBeTruthy();
  });

  it("rejects a filled honeypot", () => {
    expect(ContactSchema.safeParse({ ...valid, website: "http://spam.example" }).success).toBe(false);
  });

  it("trims whitespace", () => {
    expect(ContactSchema.parse({ ...valid, name: "  Asha Rao  " }).name).toBe("Asha Rao");
  });
});

describe("header-injection safety", () => {
  it("strips CR/LF and control characters", () => {
    expect(singleLine("Asha\r\nBcc: evil@example.com")).toBe("Asha Bcc: evil@example.com");
    expect(singleLine("a\u0000b\u007fc")).toBe("a b c");
  });
});

describe("mailtoHref (fallback when email delivery isn't configured)", () => {
  it("pre-fills subject and body, encoded", () => {
    const href = mailtoHref("vishalbg02@gmail.com", { name: "Asha", message: "Hello & welcome" });
    expect(href.startsWith("mailto:vishalbg02@gmail.com?subject=")).toBe(true);
    expect(decodeURIComponent(href)).toContain("Hello & welcome");
    expect(href).not.toMatch(/[\r\n]/);
  });
});

describe("client validator and server schema agree", () => {
  const cases: Array<[string, Record<string, string>]> = [
    ["valid", valid],
    ["name too short", { ...valid, name: "A" }],
    ["name just long enough", { ...valid, name: "Al" }],
    ["name too long", { ...valid, name: "n".repeat(LIMITS.name.max + 1) }],
    ["name at the limit", { ...valid, name: "n".repeat(LIMITS.name.max) }],
    ["no @", { ...valid, email: "nope" }],
    ["no domain dot", { ...valid, email: "a@b" }],
    ["spaces in email", { ...valid, email: "a b@example.com" }],
    ["plus addressing", { ...valid, email: "asha+jobs@example.co.in" }],
    ["message too short", { ...valid, message: "123456789" }],
    ["message exactly 10", { ...valid, message: "1234567890" }],
    ["message at the limit", { ...valid, message: "m".repeat(LIMITS.message.max) }],
    ["message over the limit", { ...valid, message: "m".repeat(LIMITS.message.max + 1) }],
    ["org too long", { ...valid, org: "o".repeat(LIMITS.org.max + 1) }],
    ["whitespace-only name", { ...valid, name: "   " }],
  ];
  it.each(cases)("%s", (_label, input) => {
    const server = ContactSchema.safeParse(input);
    const client = validateContact(input as never);
    expect(client.ok, JSON.stringify(input).slice(0, 80)).toBe(server.success);
    if (!server.success && !client.ok) {
      const serverErrors = fieldErrors(server.error);
      expect(Object.keys(client.errors).sort()).toEqual(Object.keys(serverErrors).sort());
      for (const k of Object.keys(serverErrors) as Array<keyof typeof serverErrors>)
        expect(client.errors[k]).toBe(serverErrors[k]);
    }
  });
});
