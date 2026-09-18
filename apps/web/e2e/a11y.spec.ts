import { expect, test } from "./fixtures";

/**
 * Screen-reader and keyboard checks. Aria snapshots assert the accessibility
 * tree a screen reader would announce; keyboard tests walk the real tab order.
 */
test.describe("assistive tech", () => {
  test("Home accessibility tree reads like the design", async ({ authed: page }) => {
    const main = page.getByRole("main");
    await expect(main).toMatchAriaSnapshot(`
      - paragraph: /Good (morning|afternoon|evening|night), Joe/
      - heading "Home · Japan 2027" [level=1]
      - button "Japan 2027 , switch trip"
      - button "Notifications"
    `);
    await expect(main).toMatchAriaSnapshot(`
      - heading "Saved for Mar 15" [level=2]
      - link "All 38 places"
      - link /Fuglen Tokyo Coffee/
      - link /Meiji Jingu/
      - link /Shibuya Sky/
      - link /Afuri Ramen Harajuku/
    `);
    // Landmarks: exactly one main, one visible primary nav labelled "Main".
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(1);
  });

  test("skip link, tab order and visible focus on the Home screen", async ({ authed: page }) => {
    await page.goto("/home"); // full load: focus starts at the document, not a route segment
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
    // Next tab lands on the first interactive element inside main, not back in the nav.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /switch trip/ })).toBeFocused();
    // Focus ring is real: outline is non-zero on the focused element.
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineWidth);
    expect(parseFloat(outline)).toBeGreaterThan(0);
    // Menu is keyboard operable
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await expect(page.getByRole("menuitemradio").first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(page.getByRole("button", { name: /switch trip/ })).toBeFocused();
  });

  test("navigation announces the current page", async ({ authed: page }) => {
    const nav = page.getByRole("navigation", { name: "Main" });
    const home = nav.getByRole("link", { name: "Home", exact: true });
    await expect(home).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: /^Trips?$/ }).click();
    await expect(page).toHaveURL(/\/trips$/);
    await expect(nav.getByRole("link", { name: /^Trips?$/ })).toHaveAttribute("aria-current", "page");
    await expect(home).not.toHaveAttribute("aria-current", "page");
  });

  test("Plan timeline is a list; the open slot is a dialog trigger; reduced motion is honoured", async ({ authed: page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/plan");
    await expect(page.getByRole("main")).toMatchAriaSnapshot(`
      - heading "Mon, Mar 15" [level=1]
      - radiogroup "Trip day"
      - list "Day 1 timeline":
        - listitem:
          - link /9:00 AM, Fuglen Tokyo/
        - listitem:
          - link /11:30 AM, Meiji Jingu/
        - listitem:
          - button /13:00 Harajuku lunch Open slot/
        - listitem:
          - link /4:30 PM, Shibuya Sky/
        - listitem:
          - link /7:30 PM, Afuri Ramen Harajuku/
    `);
    // With reduced motion, entrance animations complete instantly (opacity is already 1).
    const opacity = await page.getByRole("heading", { level: 1 }).evaluate((el) => getComputedStyle(el.parentElement!.parentElement!).opacity);
    expect(opacity).toBe("1");
  });

  test("forms: errors are announced and associated with fields", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: "Create account" }).click();
    const name = page.getByLabel("Your name");
    await expect(name).toHaveAttribute("aria-invalid", "true");
    const describedBy = await name.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`#${describedBy!.split(" ").pop()}`)).toHaveAttribute("role", "alert");
  });
});
