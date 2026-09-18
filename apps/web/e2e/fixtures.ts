import { test as base, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const DEMO = { email: "joe@example.com", password: "VoyaDemo-2027!" };

/** Block map tiles so runs are hermetic; the MapView renders its tint + sr-only pin list regardless. */
async function blockTiles(page: Page) {
  await page.route(/tile\.openstreetmap\.org/, (r) => r.abort());
}

export async function login(page: Page) {
  await page.goto("/login?fresh=1");
  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password").fill(DEMO.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/home$/);
}

/** Zero axe violations at WCAG 2.2 A/AA (+ best-practice rules that don't need judgement). */
export async function expectAccessible(page: Page, opts: { disable?: string[] } = {}) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .disableRules(["region", ...(opts.disable ?? [])])
    .analyze();
  const summary = results.violations.map((v) => `[${v.impact}] ${v.id}: ${v.help}\n  ${v.nodes.slice(0, 5).map((n) => n.target.join(" ")).join("\n  ")}`).join("\n\n");
  expect(summary, summary).toBe("");
}

export const test = base.extend<{ authed: Page }>({
  page: async ({ page }, run) => {
    await blockTiles(page);
    await run(page);
  },
  authed: async ({ page }, run) => {
    await login(page);
    await run(page);
  },
});
export { expect };
