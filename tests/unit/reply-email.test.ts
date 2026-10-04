import { describe, expect, it } from "vitest";
import { ownerEmail, replyEmail } from "@/lib/email/templates";

const links = {
  thread: "https://vishalbg.vercel.app/?chat=abc.def",
  unsubscribe: "https://vishalbg.vercel.app/api/live/unsubscribe?c=abc&k=def",
};

describe("the reply email", () => {
  it("shows his words, a link back to the thread and a one-click way to stop", () => {
    const m = replyEmail({ name: "Asha Rao" }, "Happy to talk tomorrow at 11.\nSee you then.", links);
    expect(m.subject).toBe("Vishal replied to your message");
    expect(m.text).toContain("Hi Asha, he replied.");
    expect(m.text).toContain("Happy to talk tomorrow at 11.\nSee you then.");
    expect(m.text).toContain(links.thread);
    expect(m.text).toContain(links.unsubscribe);
    expect(m.text).toContain("deleted after 30 days");
    expect(m.html).toContain(`href="${links.thread}"`);
    expect(m.html).toContain(`href="${links.unsubscribe.replace("&", "&amp;")}"`); // & is escaped in HTML attributes
    expect(m.html).toContain("Happy to talk tomorrow at 11.<br>See you then.");
  });

  it("escapes everything: his reply, the visitor's name and the links can never become markup", () => {
    const m = replyEmail({ name: "<img src=x onerror=alert(1)>" }, "<script>alert(1)</script> & done", {
      thread: 'https://x.test/?a="><script>',
      unsubscribe: "https://x.test/?b=1&c=2",
    });
    expect(m.html).not.toMatch(/<script|<img src=x/);
    expect(m.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; done");
    expect(m.html).toContain("https://x.test/?b=1&amp;c=2");
    expect(m.subject).not.toMatch(/[<>]/);
  });

  it("is flat: no gradients, no remote images or fonts", () => {
    const m = replyEmail({ name: "Asha" }, "Hello", links);
    expect(m.html).not.toMatch(/gradient|<img|@import|url\(/i);
  });
});

describe("the email Vishal gets", () => {
  it("says where a message came from, and defaults to the contact form", () => {
    const sub = { name: "Asha", email: "asha@example.com", message: "Hello there, a question." };
    expect(ownerEmail(sub).html).toContain("Sent from the contact form");
    const grid = ownerEmail(sub, new Date(), "GRID, the chat on the site");
    expect(grid.html).toContain("Sent from GRID, the chat on the site");
    expect(grid.text).toContain("Sent from GRID, the chat on the site at ");
    expect(grid.html).not.toContain("the contact form");
  });
});
