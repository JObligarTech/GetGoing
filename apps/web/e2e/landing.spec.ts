import { expect, expectAccessible, login, test } from "./fixtures";

test.describe("landing page", () => {
  test("renders the marketing page at / with headings, scenes, screenshots and security headers", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(/\/$/);
    expect(res!.headers()["content-security-policy"]).toMatch(/script-src 'self' 'nonce-/);
    await expect(page.getByRole("heading", { level: 1, name: "Your whole trip. One place." })).toBeVisible();
    await expect(page.getByText("Because the trip is the context for everything.")).toBeVisible();
    // Real product screenshots with descriptive alt text, light/dark aware.
    await expect(page.getByRole("img", { name: /Voya Home screen for a trip called Japan 2027/ })).toBeVisible();
    // The animated scenes are decorative for AT and carry a text equivalent.
    await expect(page.getByText(/Each one flows into the tool that needs it/)).toBeAttached();
    await expect(page.getByText(/Directions from Hotel Gracery to Afuri Ramen compared across transit/)).toBeAttached();
    await expect(page.getByText(/Group A, Joe and Sarah, take the train to Shibuya Sky/)).toBeAttached();
    // Sections are labelled landmarks reachable from the site nav.
    for (const name of ["Voya remembers the trip, so you don't have to.", "Directions that start from what Voya already knows.", "Tree routes: branch, compare, meet again.", "The rest of the trip is on its way.", "Start your first trip."]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeAttached();
    }
    await expect(page.getByRole("navigation", { name: "Site" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Legal" }).getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/legal/privacy");
    await expectAccessible(page);
  });

  test("is readable at rest and scroll-reveals settle; reduced motion disables the loops", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    // Under reduced motion nothing is parked invisible and the marquee does not move.
    const heading = page.getByRole("heading", { level: 2, name: /Voya remembers/ });
    await expect(heading).toBeVisible();
    await expect(heading).toHaveCSS("opacity", "1");
    await expect(page.locator("#context")).toHaveCSS("opacity", "1");
    expect(await page.locator(".marquee-track").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    await page.getByRole("heading", { level: 2, name: /Tree routes/ }).scrollIntoViewIfNeeded();
    await expectAccessible(page);
    // Bottom of the page: CTA and footer.
    await page.getByRole("heading", { level: 2, name: "Start your first trip." }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("link", { name: "Create account" }).last()).toBeVisible();
    await expectAccessible(page);
  });

  test("keyboard: skip link, site nav order, CTAs reach sign-up and log-in", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Voya home" })).toBeFocused();
    await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "Get started" }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await page.goto("/");
    await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("signed-in users skip the landing page", async ({ page }) => {
    await login(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/home$/);
  });
});
