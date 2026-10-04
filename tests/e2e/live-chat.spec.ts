import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";
import { gotoReady, ownClient, settleAnimations } from "./helpers";

test.beforeEach(async ({ context, page }) => {
  await ownClient(context);
  await page.route("**/api/status", (r) => r.fulfill({ json: { checkedAt: "", statuses: {} } }));
});
test.use({ viewport: { width: 1440, height: 900 } });

const SHEET = "GRID, Vishal's AI";
const sheet = (page: Page) => page.getByRole("dialog", { name: SHEET });
const axe = async (page: Page) =>
  (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()
  ).violations.filter((v) => v.impact === "serious" || v.impact === "critical");

type Msg = { n: number; from: "visitor" | "vishal"; text: string; t: number };
const C = "11111111-2222-4333-8444-555555555555";
const K = "abcdefghijklmnopqrstuvwx";

/**
 * A stand-in for the live chat API: the real routes need Redis and Telegram, which the e2e server doesn't have (the
 * routes themselves are covered in tests/unit/live-routes.test.ts). `reply()` plays Vishal answering from his phone.
 */
function mockLive(
  page: Page,
  opts: { state?: "online" | "away"; configured?: boolean; stateOnSend?: "online" | "away" } = {},
) {
  const db = {
    messages: [] as Msg[],
    version: 0,
    posts: [] as Array<Record<string, unknown>>,
    polls: 0,
    emails: [] as string[],
    failNext: null as number | null,
    gone: false,
  };
  const presence = {
    configured: opts.configured ?? true,
    state: opts.state ?? "online",
    label:
      (opts.state ?? "online") === "online"
        ? "Online — replies in minutes"
        : "Away — GRID will take a message",
    time: "11:40 pm",
    email: "vishalbg02@gmail.com",
  };
  void page.route("**/api/live/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const json = (body: object, status = 200) => route.fulfill({ status, json: body });
    if (url.pathname.endsWith("/presence")) return json(presence);
    if (url.pathname.endsWith("/message")) {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      db.posts.push(body);
      if (db.failNext) {
        const s = db.failNext;
        db.failNext = null;
        return json({ error: s === 429 ? "rate_limited" : "send_failed" }, s);
      }
      db.messages.push({
        n: db.messages.length + 1,
        from: "visitor",
        text: String(body.message),
        t: Date.now(),
      });
      db.version += 1;
      const after = opts.stateOnSend ?? presence.state;
      return json({
        ok: true,
        c: C,
        k: K,
        n: db.messages.length,
        presence: {
          ...presence,
          state: after,
          label: after === "online" ? "Online — replies in minutes" : "Away — GRID will take a message",
        },
      });
    }
    if (url.pathname.endsWith("/poll")) {
      db.polls += 1;
      if (db.gone) return json({ error: "gone" }, 404);
      const after = Number(url.searchParams.get("after"));
      const v = Number(url.searchParams.get("v"));
      return v === db.version
        ? json({ changed: false, v: db.version })
        : json({ changed: true, v: db.version, messages: db.messages.slice(after) });
    }
    if (url.pathname.endsWith("/contact")) {
      db.emails.push(String((route.request().postDataJSON() as { email: string }).email));
      return json({ ok: true });
    }
    return route.fallback();
  });
  return {
    db,
    reply(text: string) {
      db.messages.push({ n: db.messages.length + 1, from: "vishal", text, t: Date.now() });
      db.version += 1;
    },
  };
}

async function openLive(page: Page) {
  await gotoReady(page, "/");
  await page.locator("#contact").scrollIntoViewIfNeeded();
  await page
    .locator("#contact")
    .getByRole("button", { name: /Message Vishal/ })
    .click();
  await expect(sheet(page)).toBeVisible();
  return sheet(page);
}
const compose = async (
  dialog: ReturnType<typeof sheet>,
  f: { name?: string; org?: string; email?: string; message?: string },
) => {
  if (f.name !== undefined) await dialog.getByLabel("Your name").fill(f.name);
  if (f.org !== undefined) await dialog.getByLabel(/Company or role/).fill(f.org);
  if (f.email !== undefined) await dialog.getByLabel(/Your email/).fill(f.email);
  if (f.message !== undefined) await dialog.getByLabel("Message", { exact: true }).fill(f.message);
};

test.describe("Message Vishal, with live chat on", () => {
  test("shows the presence chip, takes a first message, delivers it, and shows his reply when it arrives", async ({
    page,
  }) => {
    const live = mockLive(page, { state: "online" });
    await gotoReady(page, "/");
    await page.locator("#contact").scrollIntoViewIfNeeded();
    await expect(page.locator("#contact").getByText("Online — replies in minutes")).toBeVisible();
    await page
      .locator("#contact")
      .getByRole("button", { name: /Message Vishal/ })
      .click();
    const dialog = sheet(page);
    await expect(dialog.getByText("Online — replies in minutes")).toBeVisible();
    await expect(dialog.getByText(/He's around/)).toBeVisible();
    await expect(dialog.getByText(/Messages go to Vishal's phone.*deleted after 30 days/)).toBeVisible();

    // checked in the browser first
    await dialog.getByRole("button", { name: "Send to Vishal" }).click();
    await expect(dialog.getByText("Please enter your name.")).toBeVisible();
    await expect(dialog.getByText("Write a message first.")).toBeVisible();
    expect(live.db.posts).toHaveLength(0);

    await compose(dialog, {
      name: "Asha Rao",
      org: "Infosys, SDE",
      message: "Hello Vishal, are you free for a quick call?",
    });
    await dialog.getByRole("button", { name: "Send to Vishal" }).click();
    const log = dialog.getByRole("log", { name: "Conversation with Vishal" });
    await expect(log.getByText("Hello Vishal, are you free for a quick call?")).toBeVisible();
    await expect(log.getByText(/Delivered ✓/)).toBeVisible();
    expect(live.db.posts[0]).toMatchObject({ name: "Asha Rao", org: "Infosys, SDE", page: "/", website: "" });
    expect(live.db.posts[0]!.c).toBeUndefined(); // a new conversation

    live.reply("Hi Asha! Yes, give me 5 minutes.");
    await expect(log.getByText("Hi Asha! Yes, give me 5 minutes.")).toBeVisible({ timeout: 10_000 });
    await expect(log.getByText(/^Vishal · /)).toBeVisible();

    // a follow-up goes to the same thread
    await dialog.getByLabel("Message Vishal", { exact: true }).fill("Great, thanks.");
    await dialog.getByLabel("Message Vishal", { exact: true }).press("Enter");
    await expect(log.getByText("Great, thanks.")).toBeVisible();
    expect(live.db.posts[1]).toMatchObject({ c: C, k: K, message: "Great, thanks." });
  });

  test("the thread comes back after a reload, and New chat starts again", async ({ page }) => {
    const live = mockLive(page);
    const dialog = await openLive(page);
    await compose(dialog, { name: "Asha Rao", message: "Hello Vishal, this is a test message." });
    await dialog.getByRole("button", { name: "Send to Vishal" }).click();
    await expect(dialog.getByText("Hello Vishal, this is a test message.")).toBeVisible();
    live.reply("Welcome back later!");

    await page.reload();
    await gotoReady(page, "/");
    await page.locator("#contact").scrollIntoViewIfNeeded();
    await page
      .locator("#contact")
      .getByRole("button", { name: /Message Vishal/ })
      .click();
    const again = sheet(page);
    await expect(again.getByText("Hello Vishal, this is a test message.")).toBeVisible();
    await expect(again.getByText("Welcome back later!")).toBeVisible();
    await again.getByRole("button", { name: "New chat" }).click();
    await expect(again.getByLabel("Your name")).toBeVisible();
    await expect(again.getByText("Hello Vishal, this is a test message.")).toHaveCount(0);
  });

  test("when he is away the email is required, and nothing is promised that he is there", async ({
    page,
  }) => {
    const live = mockLive(page, { state: "away" });
    const dialog = await openLive(page);
    await expect(dialog.getByText(/Vishal is away \(it's 11:40 pm in Bengaluru\)/)).toBeVisible();
    await expect(dialog.getByText("Away — GRID will take a message")).toBeVisible();
    await compose(dialog, { name: "Asha Rao", message: "Hello Vishal, please call me tomorrow." });
    await dialog.getByRole("button", { name: "Send to Vishal" }).click();
    await expect(dialog.getByText("Please enter a valid email address.")).toBeVisible();
    expect(live.db.posts).toHaveLength(0);
    await compose(dialog, { email: "asha@example.com" });
    await dialog.getByRole("button", { name: "Send to Vishal" }).click();
    await expect(dialog.getByText("He'll reply to asha@example.com if you've left the site.")).toBeVisible();
    expect(live.db.posts[0]).toMatchObject({ email: "asha@example.com" });
  });

  test("if he goes away while you were writing, you are asked for an email as soon as you send", async ({
    page,
  }) => {
    const live = mockLive(page, { state: "online", stateOnSend: "away" });
    const dialog = await openLive(page);
    await compose(dialog, { name: "Asha", message: "Hello Vishal, please call me." });
    await dialog.getByRole("button", { name: "Send to Vishal" }).click();
    const ask = dialog.getByRole("region", { name: "Leave your email" });
    await expect(ask.getByText(/He's away, so he'll answer later/)).toBeVisible();
    await ask.getByLabel("Your email").fill("asha@example.com");
    await ask.getByRole("button", { name: "Notify me by email" }).click();
    await expect(dialog.getByText("He'll reply to asha@example.com if you've left the site.")).toBeVisible();
    expect(live.db.emails).toEqual(["asha@example.com"]);
  });

  test("two minutes with no reply asks for an email, and saves it", async ({ page }) => {
    const live = mockLive(page, { state: "online" });
    await page.clock.install();
    const dialog = await openLive(page);
    await compose(dialog, { name: "Asha Rao", message: "Hello Vishal, are you there?" });
    await dialog.getByRole("button", { name: "Send to Vishal" }).click();
    await expect(dialog.getByText("Hello Vishal, are you there?")).toBeVisible();
    await expect(dialog.getByRole("region", { name: "Leave your email" })).toHaveCount(0);
    await page.clock.fastForward("02:05");
    const ask = dialog.getByRole("region", { name: "Leave your email" });
    await expect(ask.getByText("He hasn't replied yet.")).toBeVisible();
    await ask.getByLabel("Your email").fill("nope");
    await ask.getByRole("button", { name: "Notify me by email" }).click();
    await expect(ask.getByText("Please enter a valid email address.")).toBeVisible();
    await ask.getByLabel("Your email").fill("asha@example.com");
    await ask.getByRole("button", { name: "Notify me by email" }).click();
    await expect(dialog.getByText("He'll reply to asha@example.com if you've left the site.")).toBeVisible();
    expect(live.db.emails).toEqual(["asha@example.com"]);
    await expect(dialog.getByRole("region", { name: "Leave your email" })).toHaveCount(0);
  });

  test("a reply that arrives within two minutes means no email is asked for", async ({ page }) => {
    const live = mockLive(page);
    await page.clock.install();
    const dialog = await openLive(page);
    await compose(dialog, { name: "Asha Rao", message: "Hello Vishal, quick question." });
    await dialog.getByRole("button", { name: "Send to Vishal" }).click();
    await expect(dialog.getByText("Hello Vishal, quick question.")).toBeVisible();
    live.reply("Sure, go ahead.");
    await page.clock.fastForward("00:10");
    await expect(dialog.getByText("Sure, go ahead.")).toBeVisible();
    await page.clock.fastForward("02:30");
    await expect(dialog.getByRole("region", { name: "Leave your email" })).toHaveCount(0);
  });

  test("a failed send says so and keeps the message; a rate limit is explained; the thread ending resets the chat", async ({
    page,
  }) => {
    const live = mockLive(page);
    const dialog = await openLive(page);
    await compose(dialog, { name: "Asha Rao", message: "Hello Vishal, this must arrive." });
    live.db.failNext = 502;
    await dialog.getByRole("button", { name: "Send to Vishal" }).click();
    await expect(dialog.getByRole("alert")).toContainText("your message was not sent");
    await expect(dialog.getByRole("link", { name: "Email him" })).toHaveAttribute(
      "href",
      "mailto:vishalbg02@gmail.com",
    );
    await expect(dialog.getByLabel("Message", { exact: true })).toHaveValue(
      "Hello Vishal, this must arrive.",
    );
    await dialog.getByRole("button", { name: "Send to Vishal" }).click();
    await expect(dialog.getByText(/Delivered ✓/)).toBeVisible();

    live.db.failNext = 429;
    await dialog.getByLabel("Message Vishal", { exact: true }).fill("one more");
    await dialog.getByLabel("Message Vishal", { exact: true }).press("Enter");
    await expect(dialog.getByRole("alert")).toContainText("sent a lot of messages");

    live.db.gone = true;
    await expect(dialog.getByText(/That conversation has ended/)).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByLabel("Your name")).toBeVisible();
  });

  test("the link in a reply email opens the thread and is then tidied from the address bar", async ({
    page,
  }) => {
    const live = mockLive(page);
    live.db.messages.push(
      { n: 1, from: "visitor", text: "My earlier question.", t: Date.now() - 600_000 },
      { n: 2, from: "vishal", text: "Here is the answer you wanted.", t: Date.now() - 300_000 },
    );
    live.db.version = 2;
    await page.goto(`/?chat=${C}.${K}`);
    const dialog = sheet(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Here is the answer you wanted.")).toBeVisible();
    await expect(dialog.getByText("My earlier question.")).toBeVisible();
    await expect(page).not.toHaveURL(/chat=/);
  });

  test("a malformed ?chat= value is ignored", async ({ page }) => {
    mockLive(page);
    await page.goto(`/?chat=${encodeURIComponent("<script>alert(1)</script>")}`);
    await page.locator('html[data-grid="ready"]').waitFor({ state: "attached" });
    await expect(sheet(page)).toHaveCount(0);
  });

  test("the Omnibar and GRID reach it too, and Back returns to GRID", async ({ page }) => {
    mockLive(page);
    await gotoReady(page, "/work");
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("combobox")).toBeFocused();
    await page.keyboard.type("message vishal");
    await expect(page.getByRole("option").first()).toHaveText(/Message Vishal/);
    await page.keyboard.press("Enter");
    const dialog = sheet(page);
    await expect(dialog.getByRole("heading").or(dialog.getByText("Message Vishal").first())).toBeVisible();
    await expect(dialog.getByLabel("Your name")).toBeVisible();
    await dialog.getByRole("button", { name: "Back to GRID" }).click();
    await expect(dialog.getByRole("textbox", { name: "Ask GRID" })).toBeVisible();
    await dialog.getByRole("button", { name: /Message Vishal/ }).click();
    await expect(dialog.getByLabel("Your name")).toBeVisible();
  });

  test("GRID hands over: 'can I talk to him live?' shows whether he is online and opens the chat", async ({
    page,
  }) => {
    mockLive(page, { state: "online" });
    await gotoReady(page, "/");
    await page.getByRole("link", { name: "Ask GRID", exact: true }).first().click();
    const box = sheet(page).getByRole("textbox", { name: "Ask GRID" });
    await box.fill("Can I talk to him live?");
    await box.press("Enter");
    const card = sheet(page).locator('[data-grid-card="live"]');
    await expect(card).toBeVisible();
    // the e2e server itself has no live chat, so GRID says it is off; the button still opens the (mocked) chat
    await card.getByRole("button").click();
    await expect(
      sheet(page)
        .getByLabel("Your name")
        .or(sheet(page).getByText(/Leave a message|isn't switched on/))
        .first(),
    ).toBeVisible();
  });

  test("the compose form and the thread have no serious accessibility violations", async ({ page }) => {
    mockLive(page, { state: "away" });
    const dialog = await openLive(page);
    await settleAnimations(page);
    expect(await axe(page)).toEqual([]);
    await compose(dialog, {
      name: "Asha Rao",
      email: "asha@example.com",
      message: "Hello Vishal, an accessibility check.",
    });
    await dialog.getByRole("button", { name: "Send to Vishal" }).click();
    await expect(dialog.getByText(/Delivered ✓/)).toBeVisible();
    await settleAnimations(page);
    expect(await axe(page)).toEqual([]);
  });
});

test.describe("Message Vishal, with live chat off", () => {
  test("the real server has no live chat here, so the button offers 'leave a message' (GRID's card), and nothing polls", async ({
    page,
  }) => {
    const polls: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/live/poll")) polls.push(r.url());
    });
    await gotoReady(page, "/");
    await page.locator("#contact").scrollIntoViewIfNeeded();
    await expect(
      page.locator("#contact").getByText("Leave a message: it goes to his phone and inbox."),
    ).toBeVisible();
    await page
      .locator("#contact")
      .getByRole("button", { name: /Message Vishal/ })
      .click();
    const dialog = sheet(page);
    await expect(dialog.getByText("Live chat isn't switched on right now")).toBeVisible();
    await expect(dialog.locator('[data-grid-card="confirm"]').getByLabel("Message")).toBeVisible();
    await page.waitForTimeout(500);
    expect(polls).toEqual([]);
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the menu has Message Vishal, and the chat is full screen", async ({ page }) => {
    mockLive(page);
    await gotoReady(page, "/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Message Vishal" }).click();
    const dialog = sheet(page);
    await expect(dialog.getByLabel("Your name")).toBeVisible();
    const box = (await dialog.boundingBox())!;
    expect(Math.round(box.width)).toBe(390);
    await compose(dialog, { name: "Asha", message: "Hello Vishal, from my phone." });
    await dialog.getByRole("button", { name: "Send to Vishal" }).click();
    await expect(dialog.getByText(/Delivered ✓/)).toBeVisible();
  });
});
