/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixtures call `use()`; it is not a React hook */
import { test as base, expect } from "@playwright/test";

/**
 * Every e2e test starts as a visitor who has already seen the opening sequence this session (it plays once per
 * session; lib/intro/script.ts), so a test of something else is not waiting 1.8 s behind it or measuring the hero
 * mid-hand-over. The intro's own tests opt in with `test.use({ intro: true })`.
 */
export const test = base.extend<{ intro: boolean }>({
  intro: [false, { option: true }],
  context: async ({ context, intro }, use) => {
    if (!intro)
      await context.addInitScript(() => {
        try {
          sessionStorage.setItem("intro:v1", "1");
        } catch {
          /* storage blocked: the test still works, the intro just plays */
        }
      });
    await use(context);
  },
});

export { expect };
