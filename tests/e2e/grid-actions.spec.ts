import AxeBuilder from "@axe-core/playwright";
import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { profile } from "../../content/profile";
import { gotoReady, ownClient, settleAnimations } from "./helpers";

test.beforeEach(async ({ context, page }) => {
  await ownClient(context);
  await page.route("**/api/status", (r) => r.fulfill({ json: { checkedAt: "", statuses: {} } }));
});
test.use({ viewport: { width: 1440, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });

const SHEET = "GRID, Vishal's AI";
const sheet = (page: Page) => page.getByRole("dialog", { name: SHEET });
const axe = async (page: Page) =>
  (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()
  ).violations.filter((v) => v.impact === "serious" || v.impact === "critical");

async function openAndAsk(page: Page, text: string) {
  await gotoReady(page, "/");
  await page.getByRole("link", { name: "Ask GRID", exact: true }).first().click();
  await expect(sheet(page)).toBeVisible();
  const box = sheet(page).getByRole("textbox", { name: "Ask GRID" });
  await box.fill(text);
  await box.press("Enter");
  return sheet(page);
}

type Sent = {
  name: string;
  email: string;
  message: string;
  requestId: string;
  page: string;
  website: string;
};
function captureSends(
  page: Page,
  respond: (n: number) => { status: number; json: object } = () => ({ status: 200, json: { ok: true } }),
) {
  const sent: Sent[] = [];
  void page.route("**/api/grid/message", async (route) => {
    sent.push(route.request().postDataJSON() as Sent);
    const r = respond(sent.length);
    await route.fulfill({ status: r.status, json: r.json });
  });
  return sent;
}

test.describe("a message to Vishal: GRID prepares it, the visitor sends it", () => {
  test("the card opens for editing with their words in it; nothing is sent until Send, and the fields are checked first", async ({
    page,
  }) => {
    const sent = captureSends(page);
    const dialog = await openAndAsk(
      page,
      "Send him a message saying: we loved the Talnio project and would like to talk soon.",
    );
    const card = dialog.locator('[data-grid-card="confirm"]');
    await expect(card).toBeVisible();
    await expect(card.getByLabel("Message")).toHaveValue(
      "we loved the Talnio project and would like to talk soon.",
    );
    await expect(card.getByText(/review before sending/)).toBeVisible();
    expect(sent).toHaveLength(0);

    // missing name and email: refused in the browser, nothing sent
    await card.getByRole("button", { name: "Send" }).click();
    await expect(card.getByText("Please enter your name.")).toBeVisible();
    await expect(card.getByText("Please enter a valid email address.")).toBeVisible();
    expect(sent).toHaveLength(0);

    await card.getByLabel("Your name").fill("Asha Rao");
    await card.getByLabel(/Your email/).fill("asha@example.com");
    await card.getByRole("button", { name: "Send" }).click();
    await expect(card.getByRole("status")).toContainText("Sent. He'll reply to asha@example.com.");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      name: "Asha Rao",
      email: "asha@example.com",
      message: "we loved the Talnio project and would like to talk soon.",
      page: "/",
      website: "",
    });
    expect(sent[0]!.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("a sent message stays sent after a reload: the card is not offered again", async ({ page }) => {
    captureSends(page);
    const dialog = await openAndAsk(
      page,
      "Send him a message saying: hello, a quick question about your internship.",
    );
    const card = dialog.locator('[data-grid-card="confirm"]');
    await card.getByLabel("Your name").fill("Asha Rao");
    await card.getByLabel(/Your email/).fill("asha@example.com");
    await card.getByRole("button", { name: "Send" }).click();
    await expect(card.getByRole("status")).toBeVisible();

    await page.reload();
    await gotoReady(page, "/");
    await page.getByRole("link", { name: "Ask GRID", exact: true }).first().click();
    const again = sheet(page).locator('[data-grid-card="confirm"]');
    await expect(again.getByText(/Sent\./)).toBeVisible();
    await expect(again.getByRole("button", { name: "Send" })).toHaveCount(0);
  });

  test("when delivery fails the visitor is told, can email him instead, and a retry reuses the same request id", async ({
    page,
  }) => {
    const sent = captureSends(page, (n) =>
      n === 1
        ? { status: 502, json: { error: "send_failed", fallback: "mailto" } }
        : { status: 200, json: { ok: true } },
    );
    const dialog = await openAndAsk(page, "I want to message him");
    const card = dialog.locator('[data-grid-card="confirm"]');
    await card.getByLabel("Your name").fill("Asha Rao");
    await card.getByLabel(/Your email/).fill("asha@example.com");
    await card.getByLabel("Message").fill("Hello Vishal, can we talk about a role next week?");
    await card.getByRole("button", { name: "Send" }).click();
    await expect(card.getByRole("alert")).toContainText("couldn't be delivered");
    await expect(card.getByRole("link", { name: "Email him" })).toHaveAttribute(
      "href",
      new RegExp(`^mailto:${profile.contact.email.replace(".", "\\.")}`),
    );
    await card.getByRole("button", { name: "Send" }).click();
    await expect(card.getByRole("status")).toContainText("Sent.");
    expect(sent).toHaveLength(2);
    expect(sent[1]!.requestId).toBe(sent[0]!.requestId);
  });

  test("a rate-limited visitor is told to wait or write directly", async ({ page }) => {
    captureSends(page, () => ({ status: 429, json: { error: "rate_limited" } }));
    const dialog = await openAndAsk(page, "I want to message him");
    const card = dialog.locator('[data-grid-card="confirm"]');
    await card.getByLabel("Your name").fill("Asha Rao");
    await card.getByLabel(/Your email/).fill("asha@example.com");
    await card.getByLabel("Message").fill("Hello Vishal, can we talk about a role next week?");
    await card.getByRole("button", { name: "Send" }).click();
    await expect(card.getByRole("alert")).toContainText("try again later");
  });

  test("Cancel sends nothing and the card says so, and keeps saying so after a reload", async ({ page }) => {
    const sent = captureSends(page);
    const dialog = await openAndAsk(page, "I want to message him");
    await dialog.locator('[data-grid-card="confirm"]').getByRole("button", { name: "Cancel" }).click();
    await expect(dialog.getByText("Cancelled. Nothing was sent.")).toBeVisible();
    await page.reload();
    await gotoReady(page, "/");
    await page.getByRole("link", { name: "Ask GRID", exact: true }).first().click();
    await expect(sheet(page).getByText("Cancelled. Nothing was sent.")).toBeVisible();
    expect(sent).toHaveLength(0);
  });

  test("with the model proposing a complete message, the card starts as a read-only review with Edit, Send and Cancel", async ({
    page,
  }) => {
    await page.route("**/api/chat", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: { ai: true } });
      const events = [
        { t: "meta", mode: "ai", sources: [] },
        { t: "tool", id: "c1", name: "send_message_to_vishal", state: "running" },
        {
          t: "part",
          id: "c1",
          part: {
            kind: "confirm",
            action: "send_message",
            name: "Asha Rao",
            email: "asha@example.com",
            message: "Hello Vishal, we would like to invite you to interview next week.",
            mailto: profile.contact.email,
          },
        },
        { t: "tool", id: "c1", name: "send_message_to_vishal", state: "done" },
        { t: "text", d: "I've prepared it. Please check it and press Send." },
        { t: "done" },
      ];
      await route.fulfill({
        contentType: "application/x-ndjson",
        body: events.map((e) => JSON.stringify(e)).join("\n") + "\n",
      });
    });
    const sent = captureSends(page);
    const dialog = await openAndAsk(page, "Please pass on that we would like to invite him to interview");
    const card = dialog.locator('[data-grid-card="confirm"]');
    await expect(card.getByText("Asha Rao <asha@example.com>")).toBeVisible();
    await expect(card.getByLabel("Your name")).toHaveCount(0); // review, not a form
    await card.getByRole("button", { name: "Edit" }).click();
    await expect(card.getByLabel("Your name")).toHaveValue("Asha Rao");
    await card.getByRole("button", { name: "Done editing" }).click();
    expect(sent).toHaveLength(0); // the model's proposal went nowhere on its own
    await card.getByRole("button", { name: "Send" }).click();
    await expect(card.getByRole("status")).toBeVisible();
    expect(sent).toHaveLength(1);
  });

  test("the form is accessible and keyboard-operable", async ({ page }) => {
    const dialog = await openAndAsk(page, "I want to message him");
    const card = dialog.locator('[data-grid-card="confirm"]');
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Send" }).click(); // shows the errors too
    await settleAnimations(page);
    expect(await axe(page)).toEqual([]);
    await card.getByLabel("Your name").focus();
    await page.keyboard.press("Tab");
    await expect(card.getByLabel(/Your email/)).toBeFocused();
  });
});

test.describe("drafts, booking and interview notes", () => {
  test("a draft is a template with [placeholders] to fill; it can be edited, copied, or sent from here", async ({
    page,
  }) => {
    const sent = captureSends(page);
    const dialog = await openAndAsk(
      page,
      "Draft an interview invite for the Backend Engineer role at Infosys",
    );
    const card = dialog.locator('[data-grid-card="draft"]');
    await expect(card.getByLabel("Subject")).toHaveValue("Interview invitation: Backend Engineer at Infosys");
    const body = card.getByLabel("Message");
    await expect(body).toHaveValue(/^Hi Vishal,/);
    await expect(body).toHaveValue(/\[your name\]/);
    await body.fill(
      "Hi Vishal,\n\nWe would like to invite you to interview for the Backend Engineer role at Infosys. Are you free on Friday?\n\nThanks,\nAsha",
    );

    await card.getByRole("button", { name: "Copy" }).click();
    await expect(page.getByText("Draft copied")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      "Interview invitation: Backend Engineer at Infosys",
    );

    await card.getByRole("button", { name: "Send to Vishal" }).click();
    const confirm = dialog.locator('[data-grid-card="confirm"]');
    await expect(confirm.getByLabel("Message")).toHaveValue(/Are you free on Friday\?/);
    expect(sent).toHaveLength(0); // still needs the visitor's name, email and a press of Send
  });

  test("booking: the Cal.com link when he has set one, an offer to leave a message when not", async ({
    page,
  }) => {
    const dialog = await openAndAsk(page, "Can I book a call with him?");
    const card = dialog.locator('[data-grid-card="book"]');
    if (profile.contact.calLink) {
      const link = card.getByRole("link", { name: /Book a 15-minute call/ });
      await expect(link).toHaveAttribute("href", profile.contact.calLink);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
    } else {
      await expect(card.getByText(/isn't set up yet/)).toBeVisible();
      await card.getByRole("button", { name: "Leave a message" }).click();
      await expect(dialog.locator('[data-grid-card="confirm"]').getByLabel("Message")).toHaveValue(
        /book a short call/,
      );
    }
  });

  test("interview mode is not offered until Vishal has written his answers", async ({ page }) => {
    await gotoReady(page, "/");
    await page.getByRole("link", { name: "Ask GRID", exact: true }).first().click();
    const modes = sheet(page).getByRole("group", { name: "Mode" });
    await expect(modes.getByRole("button", { name: "Recruiter" })).toBeVisible();
    await expect(modes.getByRole("button", { name: "Interview" })).toHaveCount(0);
  });
});

test.describe("a tailored résumé", () => {
  test("shows what moved, what is emphasised and the gaps, and downloads a one-page PDF named for the role", async ({
    page,
  }) => {
    const dialog = await openAndAsk(page, "Tailor his résumé for a Java Spring Boot Kubernetes role");
    const card = dialog.locator('[data-grid-card="resume"]');
    await expect(card.getByRole("heading", { name: "Gaps (not hidden)" })).toBeVisible();
    await expect(card.getByRole("listitem").filter({ hasText: "Kubernetes" })).toBeVisible();
    await expect(card.getByText(/no new text is added/)).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      card.getByRole("button", { name: "Download PDF" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^Vishal_BG_Resume_.+\.pdf$/);
    const bytes = (await import("node:fs")).readFileSync((await download.path())!);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.toString("latin1").match(/\/Type\s*\/Page\b(?!s)/g)).toHaveLength(1);
  });

  test("a job match offers the tailored résumé for that job, with the same card", async ({ page }) => {
    const jd =
      "Backend Engineer. Responsibilities: build REST APIs with Java and Spring Boot. Requirements: Java, Spring Boot, Docker and Kubernetes, 3+ years of experience. We are looking for someone who ships and owns what they build. Nice to have: React. About the role: you will own services behind our mobile apps.";
    const dialog = await openAndAsk(page, jd);
    const match = dialog.locator('[data-grid-card="match"]');
    await expect(match).toBeVisible({ timeout: 15_000 });
    await expect(match.getByRole("listitem").first()).toBeVisible(); // the lazy result has loaded
    await match.getByRole("button", { name: "Tailor his résumé for this job" }).click();
    const resume = dialog.locator('[data-grid-card="resume"]');
    await expect(resume.getByRole("heading", { name: "Gaps (not hidden)" })).toBeVisible();
    await expect(
      resume
        .getByRole("listitem")
        .filter({ hasText: /Docker|Kubernetes/ })
        .first(),
    ).toBeVisible();
  });

  test("the résumé cards have no serious accessibility violations", async ({ page }) => {
    const dialog = await openAndAsk(page, "Tailor his résumé for a Java Spring Boot role");
    await expect(dialog.locator('[data-grid-card="resume"]')).toBeVisible();
    await settleAnimations(page);
    expect(await axe(page)).toEqual([]);
  });
});

test.describe("language and voice", () => {
  test("choosing Kannada or Hindi sends that language with the question; Auto sends none", async ({
    page,
  }) => {
    const bodies: Array<{ lang?: string }> = [];
    await page.route("**/api/chat", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: { ai: true } });
      bodies.push(route.request().postDataJSON());
      await route.fulfill({
        contentType: "application/x-ndjson",
        body:
          [{ t: "meta", mode: "ai", sources: [] }, { t: "text", d: "ಉತ್ತರ" }, { t: "done" }]
            .map((e) => JSON.stringify(e))
            .join("\n") + "\n",
      });
    });
    await gotoReady(page, "/");
    await page.getByRole("link", { name: "Ask GRID", exact: true }).first().click();
    const langs = sheet(page).getByRole("combobox", { name: "Reply language" });
    await expect(langs).toHaveValue("auto");
    await langs.selectOption({ label: "ಕನ್ನಡ" });
    await expect(langs).toHaveValue("kn");
    const box = sheet(page).getByRole("textbox", { name: "Ask GRID" });
    await box.fill("What has he built?");
    await box.press("Enter");
    await expect(sheet(page).getByText("ಉತ್ತರ")).toBeVisible();
    expect(bodies[0]!.lang).toBe("kn");
    await langs.selectOption({ label: "Auto" });
    await box.fill("And his skills?");
    await box.press("Enter");
    await expect.poll(() => bodies.length).toBe(2);
    expect(bodies[1]!.lang).toBeUndefined();
  });

  test("dictation fills the text box (never sends by itself); spoken replies are off until turned on and read the answer without markers", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const spoken: string[] = [];
      (window as unknown as { __spoken: string[] }).__spoken = spoken;
      class FakeRecognition {
        lang = "";
        interimResults = false;
        continuous = false;
        maxAlternatives = 1;
        onresult: ((e: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        onerror: ((e: { error: string }) => void) | null = null;
        start() {
          (window as unknown as { __recLang: string }).__recLang = this.lang;
          setTimeout(() => this.onresult?.({ results: [[{ transcript: "what has he built" }]] }), 30);
        }
        stop() {
          this.onend?.();
        }
        abort() {}
      }
      for (const name of ["SpeechRecognition", "webkitSpeechRecognition"])
        Object.defineProperty(window, name, { value: FakeRecognition, configurable: true, writable: true });
      class Utterance {
        text: string;
        lang = "";
        voice: unknown = null;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      }
      (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = Utterance;
      Object.defineProperty(window, "speechSynthesis", {
        value: {
          getVoices: () => [],
          addEventListener() {},
          removeEventListener() {},
          cancel() {},
          speak(u: { text: string; onstart?: () => void; onend?: () => void }) {
            spoken.push(u.text);
            u.onstart?.();
            setTimeout(() => u.onend?.(), 20);
          },
        },
        configurable: true,
      });
    });
    await page.route("**/api/chat", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: { ai: true } });
      await route.fulfill({
        contentType: "application/x-ndjson",
        body:
          [
            { t: "meta", mode: "ai", sources: [{ n: 1, title: "Talnio", url: "/work/talnio" }] },
            { t: "text", d: "Vishal built **Talnio** [1] with Flutter." },
            { t: "done" },
          ]
            .map((e) => JSON.stringify(e))
            .join("\n") + "\n",
      });
    });
    await gotoReady(page, "/");
    await page.getByRole("link", { name: "Ask GRID", exact: true }).first().click();
    const dialog = sheet(page);

    const mic = dialog.getByRole("button", { name: "Speak your question" });
    await mic.click();
    const box = dialog.getByRole("textbox", { name: "Ask GRID" });
    await expect(box).toHaveValue("what has he built"); // heard, shown, editable, NOT sent
    await expect(dialog.getByRole("log").getByText("what has he built", { exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("status")).toContainText("Listening");
    await dialog.getByRole("button", { name: "Stop dictation" }).click();

    // spoken replies are off by default
    const speaker = dialog.getByRole("button", { name: "Speak replies aloud" });
    await expect(speaker).toHaveAttribute("aria-pressed", "false");
    await box.press("Enter");
    await expect(dialog.getByText(/Vishal built/)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toEqual([]);

    // turn it on: the next answer is read, without [1] or ** marks
    await speaker.click();
    await expect(dialog.getByRole("button", { name: "Mute spoken replies" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // turning it on does not read the answer that is already there
    expect(await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toEqual([]);
    await box.fill("And his skills?");
    await box.press("Enter");
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.length))
      .toBe(1);
    expect(await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken[0])).toBe(
      "Vishal built Talnio with Flutter.",
    );
  });

  test("dictation listens in the chosen language", async ({ page }) => {
    await page.addInitScript(() => {
      class FakeRecognition {
        lang = "";
        interimResults = false;
        continuous = false;
        maxAlternatives = 1;
        onresult: ((e: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        start() {
          (window as unknown as { __recLang: string }).__recLang = this.lang;
        }
        stop() {}
        abort() {}
      }
      for (const name of ["SpeechRecognition", "webkitSpeechRecognition"])
        Object.defineProperty(window, name, { value: FakeRecognition, configurable: true, writable: true });
    });
    await gotoReady(page, "/");
    await page.getByRole("link", { name: "Ask GRID", exact: true }).first().click();
    await sheet(page).getByRole("combobox", { name: "Reply language" }).selectOption({ label: "हिन्दी" });
    await sheet(page).getByRole("button", { name: "Speak your question" }).click();
    expect(await page.evaluate(() => (window as unknown as { __recLang: string }).__recLang)).toBe("hi-IN");
  });

  test("where the browser has no speech support, no microphone or speaker is shown", async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      delete w.SpeechRecognition;
      delete w.webkitSpeechRecognition;
      Object.defineProperty(window, "speechSynthesis", { value: undefined, configurable: true });
      delete w.SpeechSynthesisUtterance;
    });
    await gotoReady(page, "/");
    await page.getByRole("link", { name: "Ask GRID", exact: true }).first().click();
    await expect(sheet(page).getByRole("textbox", { name: "Ask GRID" })).toBeVisible();
    await expect(
      sheet(page).getByRole("button", { name: /Speak your question|Speak replies aloud/ }),
    ).toHaveCount(0);
  });
});
