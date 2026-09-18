import { expect, expectAccessible, test } from "./fixtures";

test.describe("core flows (signed in)", () => {
  test("Home shows the trip context from the mockups", async ({ authed: page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Japan 2027");
    await expect(page.getByText("Good", { exact: false }).first()).toContainText(/Good (morning|afternoon|evening|night), Joe/);
    await expect(page.getByText("12 days away").first()).toBeVisible();
    await expect(page.getByText("Tokyo", { exact: true }).first()).toBeVisible();
    // Stay card + today's places
    const stayCard = page.getByRole("link", { name: /Your stay: Hotel Gracery Shinjuku/ });
    await expect(stayCard).toBeVisible();
    await expect(stayCard).toContainText("Check-in 3:00 PM"); // trip time zone, not UTC
    for (const name of ["Fuglen Tokyo", "Meiji Jingu", "Shibuya Sky", "Afuri Ramen Harajuku"]) {
      await expect(page.getByRole("link", { name: new RegExp(name) }).first()).toBeVisible();
    }
    // The map is an image with a text alternative listing its pins.
    const map = page.getByRole("img", { name: /Map of Tokyo with \d+ pins/ }).first();
    await expect(map).toBeVisible();
    await expect(map.locator("ul li")).toHaveCount(5);
    await expectAccessible(page);
  });

  test("trip switcher changes the active trip", async ({ authed: page }) => {
    await page.getByRole("button", { name: /switch trip/ }).click();
    const menu = page.getByRole("menu", { name: "Switch trip" });
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitemradio", { name: /Lisbon 2026/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Lisbon 2026");
    await expect(page.getByText("Ended").first()).toBeVisible();
  });

  test("Trips list, overview and create", async ({ authed: page }) => {
    await page.goto("/trips");
    await expect(page.getByRole("heading", { level: 1, name: "Trips" })).toBeVisible();
    const active = page.getByRole("link", { name: /Japan 2027.*active trip/ });
    await expect(active).toHaveAttribute("aria-current", "true");
    await expect(page.getByRole("link", { name: /Lisbon 2026.*Past/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Bali.*Draft/ })).toBeVisible();
    await expect(page.getByText("Day 1–5")).toBeVisible();
    await expectAccessible(page);

    await active.click();
    await expect(page.getByRole("heading", { level: 1, name: "Japan 2027" })).toBeVisible();
    await expect(page.getByText("Tokyo → Kyoto → Osaka")).toBeVisible();
    await expect(page.getByText("GRC-884120")).toBeHidden(); // confirmation lives on the stay page, not the overview
    await expect(page.getByRole("link", { name: /Hotel Gracery Shinjuku/ })).toBeVisible();
    await expectAccessible(page);

    await page.goto("/trips/new");
    await page.getByLabel("Trip name").fill("Iceland 2028");
    await page.getByLabel("Start date").fill("2028-07-01");
    await page.getByLabel("End date").fill("2028-06-01");
    await page.getByRole("button", { name: "Create trip" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "End date" })).toContainText("End date must be after start");
    // Values survive a failed submit (React 19 would otherwise reset the form).
    await expect(page.getByLabel("Trip name")).toHaveValue("Iceland 2028");
    await page.getByLabel("End date").fill("2028-07-10");
    await page.getByLabel("Cities").fill("Reykjavík, Vík");
    await page.getByLabel("Local currency").fill("isk");
    await page.getByRole("button", { name: "Create trip" }).click();
    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Iceland 2028" })).toBeVisible();
    await expect(page.getByText("ISK")).toBeVisible();
  });

  test("Plan: day timeline, open slot suggestions, fill the slot, map view", async ({ authed: page }) => {
    await page.goto("/plan");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mon, Mar 15");
    const timeline = page.getByRole("list", { name: "Day 1 timeline" });
    await expect(timeline.getByRole("listitem")).toHaveCount(5);
    await expect(page.getByRole("link", { name: /9:00 AM, Fuglen Tokyo, Coffee/ })).toBeVisible();
    await expect(page.getByText(/Tap the open slot to pick from 2 saved places nearby/)).toBeVisible();
    await expectAccessible(page);

    // Day picker is a radiogroup; Day 2 is empty
    await page.getByRole("radio", { name: /Day 2/ }).click();
    await expect(page).toHaveURL(/day=2027-03-16/);
    await expect(page.getByText("Nothing on Day 2 yet")).toBeVisible();
    await page.getByRole("radio", { name: /Day 1,/ }).click();

    // Open slot → dialog → Add
    await page.getByRole("button", { name: /Harajuku lunch/ }).click();
    const dialog = page.getByRole("dialog", { name: "Fill the 13:00 slot" });
    await expect(dialog).toBeVisible();
    // Focus moves into the dialog (onto the nearest suggestion, which is the first row).
    await expect(dialog.locator(":focus")).toHaveCount(1);
    await expect(dialog.getByRole("button", { name: /Add/ }).first()).toBeFocused();
    await dialog.getByRole("button", { name: /Cafe Kitsuné/ }).click();
    await expect(page.getByRole("link", { name: /1:00 PM, Cafe Kitsuné, Coffee/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Harajuku lunch/ })).toHaveCount(0);

    // Place page with the local-language address disclosure
    await page.getByRole("link", { name: /Cafe Kitsuné/ }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Cafe Kitsuné" })).toBeVisible();
    const disclosure = page.getByRole("button", { name: "Show address in 日本語" });
    await expect(disclosure).toHaveAttribute("aria-expanded", "false");
    await disclosure.click();
    await expect(page.getByRole("region", { name: "Show address in 日本語" })).toContainText("東京都港区南青山4-3-5");
    await expectAccessible(page);
  });

  test("stay page has 'Take me back to my hotel'", async ({ authed: page }) => {
    await page.getByRole("link", { name: /Your stay: Hotel Gracery/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Hotel Gracery Shinjuku" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Take me back to my hotel" })).toBeVisible();
    await expect(page.getByText("GRC-884120")).toBeVisible();
    await expectAccessible(page);
  });

  test("profile: theme toggle, legal links, data export, delete dialog", async ({ authed: page }) => {
    await page.goto("/profile");
    await expectAccessible(page);
    const theme = page.getByRole("radiogroup", { name: "Theme" });
    await theme.getByRole("radio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark"); // persisted, applied before paint
    await theme.getByRole("radio", { name: "Follow system" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);

    const dl = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download my data" }).click();
    expect((await dl).suggestedFilename()).toMatch(/^voya-export-\d{4}-\d{2}-\d{2}\.json$/);

    await page.getByRole("button", { name: "Delete my account" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete your account?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Keep my account" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.getByRole("link", { name: "Privacy Policy" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
    await expectAccessible(page);
  });
});
