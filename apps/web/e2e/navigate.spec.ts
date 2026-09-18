import { expect, expectAccessible, test } from "./fixtures";

const AFURI = "44444444-4444-4444-8444-444444444445";
const MORNING_SHIBUYA = "55555555-5555-4555-8555-555555555551";

test.describe("Navigate (round 2)", () => {
  test("hub: contextual shortcuts and saved routes", async ({ authed: page }) => {
    await page.goto("/navigate");
    await expect(page.getByRole("heading", { level: 1, name: "Navigate" })).toBeVisible();
    // "Voya already knows": hotel, tonight's dinner, next planned place.
    await expect(page.getByRole("link", { name: "Take me to my hotel: Hotel Gracery Shinjuku" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tonight's dinner: Afuri Ramen Harajuku" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Next planned: Shibuya Sky" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Navigate the day.*Day 1 · hotel → 4 stops → hotel/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Morning Shibuya.*4 stops · Walk/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Airport → Hotel.*1 stop · Transit/ })).toBeVisible();
    await expectAccessible(page);
  });

  test("directions: compare modes with the keyboard, read steps, share the ETA", async ({ authed: page, browserName }) => {
    await page.goto("/navigate");
    await page.getByRole("link", { name: "Tonight's dinner: Afuri Ramen Harajuku" }).click();
    await expect(page).toHaveURL(new RegExp(`/navigate/route\\?to=${AFURI}$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("To Afuri Ramen Harajuku");
    await expect(page.getByText("from your hotel")).toBeVisible();

    // Modes are a radiogroup; transit is the default and carries a fare.
    const modes = page.getByRole("radiogroup", { name: "Travel mode" });
    const transit = modes.getByRole("radio", { name: /^Transit, / });
    await expect(transit).toBeChecked();
    await expect(modes.getByRole("radio")).toHaveCount(4);
    await expect(page.getByText(/^¥\d/).first()).toBeVisible();
    const steps = page.getByRole("list", { name: "Directions steps" });
    await expect(steps.getByRole("listitem").first()).toContainText(/^Walk to/);
    await expect(steps.getByRole("listitem").last()).toContainText(/^Arrive/);
    const map = page.getByRole("img", { name: /Map of the transit route from Hotel Gracery Shinjuku to Afuri Ramen Harajuku/ });
    await expect(map).toBeVisible();
    // The route line is really on the map (MapLibre's worker tiled it), not just requested.
    await expect(map).toHaveAttribute("data-route-state", "drawn", { timeout: 15_000 });

    // Arrow keys move through the modes and re-route (roving tabindex: only the checked radio is tabbable).
    await transit.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/mode=drive/);
    await expect(modes.getByRole("radio", { name: /^Drive, / })).toBeChecked();
    await expect(modes.getByRole("radio", { name: /^Drive, / })).toBeFocused();
    await expect(steps.getByRole("listitem").first()).toContainText(/^Head/);
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/mode=transit/);
    await expectAccessible(page);

    // Share ETA falls back to the clipboard where the Web Share API is missing (desktop Chromium).
    const isPhone = (await page.viewportSize())!.width < 1024;
    if (isPhone) {
      await expect(page.getByRole("status", { name: /^Next: Walk to/ })).toBeVisible(); // turn card over the map
    } else if (browserName === "chromium") {
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.getByRole("button", { name: "Share ETA" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Copied to clipboard" })).toHaveCount(1);
      const text = await page.evaluate(() => navigator.clipboard.readText());
      expect(text).toMatch(/^Joe arrives at Afuri Ramen Harajuku around \d{1,2}:\d{2} [AP]M/);
    }
    // "Instead" shortcuts swap the destination but keep the mode.
    await page.getByRole("link", { name: "Next planned" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("To Shibuya Sky");
    await expect(page).toHaveURL(/mode=transit/);
  });

  test("day route: totals, reorder with announcements, switch mode, save", async ({ authed: page }) => {
    await page.goto("/navigate/day?day=2027-03-15");
    await expect(page.getByRole("heading", { level: 1, name: "Day 1 route" })).toBeVisible();
    const totals = page.getByRole("group", { name: "Route totals" });
    await expect(totals).toContainText("Total");
    await expect(totals).toContainText("On foot");
    const list = page.getByRole("list", { name: "Stops in order" });
    const items = list.getByRole("listitem");
    await expect(items).toHaveCount(6);
    await expect(items.nth(0)).toContainText(/Hotel Gracery Shinjuku.*Leave \d{2}:\d{2}/);
    await expect(items.nth(1)).toContainText(/Fuglen Tokyo.*Arrive 09:00/); // leaves the hotel in time for the first plan
    await expect(items.nth(5)).toContainText("Back to hotel");
    // Bookends can't move; the first movable stop can't move up, the last can't move down.
    await expect(list.getByRole("button", { name: /^Move Hotel/ })).toHaveCount(0);
    await expect(list.getByRole("button", { name: "Move Fuglen Tokyo up" })).toBeDisabled();
    await expect(list.getByRole("button", { name: "Move Afuri Ramen Harajuku down" })).toBeDisabled();
    await expectAccessible(page);

    // Keyboard reorder: the row moves, the URL carries the order, and a live region announces it.
    await list.getByRole("button", { name: "Move Fuglen Tokyo down" }).click();
    await expect(page).toHaveURL(/order=/);
    await expect(items.nth(1)).toContainText("Meiji Jingu");
    await expect(items.nth(2)).toContainText("Fuglen Tokyo");
    await expect(page.getByRole("status").filter({ hasText: "Fuglen Tokyo moved to stop 2 of 4" })).toHaveCount(1);

    // Transit re-routes every leg and adds fares.
    await expect(totals).toContainText("—");
    await page.getByRole("radiogroup", { name: "Travel mode" }).getByRole("radio", { name: "Transit" }).click();
    await expect(page).toHaveURL(/mode=transit/);
    await expect(page.getByRole("radio", { name: "Transit" })).toBeChecked();
    await expect(totals).toContainText(/¥\d/);
    await expect(items.nth(2)).toContainText("Fuglen Tokyo"); // reorder survives the mode switch

    // Save under a name → appears on the hub.
    const name = page.getByLabel("Route name");
    await name.fill("");
    await page.getByRole("button", { name: "Save route" }).click();
    // The empty name comes back as a field error: announced (role=alert) and tied to the input.
    await expect(name).toHaveAttribute("aria-invalid", "true");
    const errId = (await name.getAttribute("aria-describedby"))!.split(" ").pop()!;
    await expect(page.locator(`[id="${errId}"]`)).toHaveAttribute("role", "alert");
    await expect(page.locator(`[id="${errId}"]`)).toBeVisible();
    await name.fill("Meiji first");
    await page.getByRole("button", { name: "Save route" }).click();
    await expect(page.getByRole("status").filter({ hasText: 'Saved "Meiji first" to your routes.' })).toHaveCount(1);
    await page.goto("/navigate");
    const saved = page.getByRole("link", { name: /Meiji first.*6 stops · Transit/ });
    await expect(saved).toBeVisible();
    await saved.click();
    await expect(page.getByRole("heading", { level: 1, name: "Meiji first" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Stops in order" }).getByRole("listitem").nth(1)).toContainText("Meiji Jingu");
  });

  test("saved route is read-only and reachable from the hub", async ({ authed: page }) => {
    await page.goto(`/navigate/day?route=${MORNING_SHIBUYA}`);
    await expect(page.getByRole("heading", { level: 1, name: "Morning Shibuya" })).toBeVisible();
    await expect(page.getByText("Saved route")).toBeVisible();
    const items = page.getByRole("list", { name: "Stops in order" }).getByRole("listitem");
    await expect(items).toHaveCount(4);
    await expect(items.nth(0)).toContainText("Hotel Gracery Shinjuku");
    await expect(items.nth(1)).toContainText("Fuglen Tokyo");
    await expect(page.getByRole("button", { name: "Save route" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Move / })).toHaveCount(0);
    await expectAccessible(page);
    // Unknown route id → 404, not someone else's data.
    const res = await page.goto("/navigate/day?route=55555555-5555-4555-8555-555555555599");
    expect(res?.status()).toBe(404);
  });

  test("deep links: Home and place pages start directions", async ({ authed: page }) => {
    await page.getByRole("link", { name: /Your stay: Hotel Gracery/ }).click();
    await page.getByRole("link", { name: "Take me back to my hotel" }).click();
    await expect(page).toHaveURL(/\/navigate\/route\?to=44444444-4444-4444-8444-444444444441/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("To Hotel Gracery Shinjuku");
    // Bad ids are rejected by the query schema before any lookup.
    const res = await page.goto("/navigate/route?to=not-a-uuid");
    expect(res?.status()).toBe(404);
  });
});
