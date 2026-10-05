import { describe, expect, it } from "vitest";
import { SlotsSchema, extractSlots } from "@/lib/ai/agent/slots";

describe("extractSlots: who is writing, from what they typed", () => {
  it.each([
    [
      "I'm Priya from Acme, priya@acme.dev - please tell Vishal we'd like to interview him for a backend role",
      { name: "Priya", email: "priya@acme.dev", company: "Acme", role: "backend" },
    ],
    [
      "Hi, this is Rahul Sharma, HR at Infosys. We're hiring a Java Developer. Reach me at rahul.sharma@infosys.com",
      { name: "Rahul Sharma", email: "rahul.sharma@infosys.com", company: "Infosys", role: "Java Developer" },
    ],
    [
      "My name is Ananya and I work for Zoho Corporation. Send Vishal a message: we have a Full Stack Engineer opening",
      { name: "Ananya", company: "Zoho Corporation", role: "Full Stack Engineer" },
    ],
    ["message vishal: loved Talnio! — sam@example.org", { email: "sam@example.org" }],
    ["Tell him I'm interested in hiring him for the SDE role. I'm Kiran.", { name: "Kiran", role: "SDE" }],
    [
      "Please pass a note to Vishal from Meera at Freshworks: can we talk about a backend position?",
      { name: "Meera", company: "Freshworks", role: "backend" },
    ],
    [
      "Hey, it's Arjun (arjun@startup.io). We'd love to chat about the Backend Engineer role at Razorpay.",
      { name: "Arjun", email: "arjun@startup.io", company: "Razorpay", role: "Backend Engineer" },
    ],
    ["Send Vishal a message saying hi", {}],
    [
      "Recruiter here, name: Neha Gupta, company: TCS, role: Software Engineer, neha.g@tcs.com",
      { name: "Neha Gupta", email: "neha.g@tcs.com", company: "TCS", role: "Software Engineer" },
    ],
    ["I'm from Acme and I'm hiring. Tell Vishal to call me.", { company: "Acme" }],
    [
      "This is Dev with Google Cloud. Can you tell him we're hiring an Associate Developer?",
      { name: "Dev", company: "Google Cloud", role: "Associate Developer" },
    ],
  ])("%s", (text, expected) => {
    expect(extractSlots(text)).toEqual(expected);
  });

  it("never returns a value the schema would refuse", () => {
    const tricky = [
      "I'm A from B",
      "email me at not-an-email@",
      `I'm ${"Verylongname".repeat(10)} from Co`,
      "role: x",
      "",
    ];
    for (const t of tricky) expect(SlotsSchema.safeParse(extractSlots(t)).success, t).toBe(true);
  });

  it("does not mistake Vishal, his projects or pronouns for the sender's company", () => {
    expect(extractSlots("Tell him I loved working with Talnio at Vishal's site").company).toBeUndefined();
    expect(extractSlots("I'm keen to talk with Vishal").company).toBeUndefined();
  });
});

describe("the message card is pre-filled from what the visitor typed (A5), and still editable", () => {
  it("router: name, email, company and role land in the confirm card; nothing is sent", async () => {
    const { routeIntent } = await import("@/lib/ai/agent/router");
    const routed = await routeIntent(
      "I'm Priya from Acme, priya@acme.dev - please tell Vishal we'd like to interview him for a backend role",
      {},
    );
    const part = routed!.parts[0]!.part;
    expect(routed!.parts[0]!.tool).toBe("send_message_to_vishal");
    expect(part).toMatchObject({
      kind: "confirm",
      name: "Priya",
      email: "priya@acme.dev",
      company: "Acme",
      role: "backend",
      message: "we'd like to interview him for a backend role",
    });
    expect(routed!.text).toMatch(/Nothing is sent until you press Send/);
  });
});
