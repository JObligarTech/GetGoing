import { expect, expectAccessible, test } from "./fixtures";

const SHIBUYA_TREE = "55555555-5555-4555-8555-555555555553";

test.describe("Navigation tree (round 3)", () => {
  test("saved tree: hub link, lanes with travelers, compare view, insight", async ({ authed: page }) => {
    await page.goto("/navigate");
    await page.getByRole("link", { name: /Shibuya afternoon.*Tree route · 2 groups · 4 stops/ }).click();
    await expect(page).toHaveURL(new RegExp(`/navigate/tree\\?route=${SHIBUYA_TREE}$`));
    await expect(page.getByRole("textbox", { name: "Route name" })).toHaveValue("Shibuya afternoon");
    const tree = page.getByRole("list", { name: "Route tree" });
    // Trunk: hotel (everyone leaves 2:30 PM) → split → dinner (everyone meets).
    await expect(tree.getByRole("button", { name: /^Hotel Gracery Shinjuku: Everyone · leave 2:30 PM/ })).toBeVisible();
    const laneA = tree.getByRole("region", { name: "Group A: Joe, Sarah" });
    const laneB = tree.getByRole("region", { name: "Group B: Chris, Daniel" });
    await expect(laneA).toBeVisible();
    await expect(laneB).toBeVisible();
    await expect(laneA.getByRole("button", { name: /^Shibuya Sky: Arrive \d{1,2}:\d{2} [AP]M · 1 h 30 there · by transit/ })).toBeVisible();
    await expect(laneB.getByRole("button", { name: /^Pokémon Center Shibuya: Arrive .* · 1 h there · by walk/ })).toBeVisible();
    await expect(tree.getByRole("button", { name: /^Afuri Ramen Harajuku: Everyone meets · 7:30 PM/ })).toBeVisible();
    await expect(page.getByText(/Everyone back together by/)).toBeVisible();
    await expectAccessible(page);

    // Compare: one card per group with door-to-door time and the insight.
    await page.getByRole("toolbar", { name: "Edit tree" }).getByRole("button", { name: "Compare" }).click();
    await expect(page.getByRole("region", { name: "Group A", exact: true })).toContainText(/Door to Afuri/);
    await expect(page.getByRole("region", { name: "Group B", exact: true })).toContainText(/Transfers\s*0/);
    await expect(page.getByRole("region", { name: "Group A", exact: true })).toContainText(/Fares\s*¥\d+ pp/);
    await expect(page.getByRole("note").first()).toContainText(/arrives .* earlier|arrive together/);
    await expect(page.getByRole("note").first()).toContainText("Both make the 7:30 PM plan.");
    await expect(page.getByRole("region", { name: "Alternatives for Group A" }).getByRole("button", { name: /Walk instead of train/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start Group A" })).toHaveAttribute("href", /\/navigate\/route\?to=44444444-4444-4444-8444-444444444444/);
    await expectAccessible(page);
  });

  test("build a tree from the day: branch, assign travelers, merge, mode per segment, save, reload", async ({ authed: page }) => {
    await page.goto("/navigate/tree?day=2027-03-15");
    const tree = page.getByRole("list", { name: "Route tree" });
    await expect(tree.getByRole("button")).toHaveCount(6); // hotel → 4 stops → hotel, no lanes yet
    const toolbar = page.getByRole("toolbar", { name: "Edit tree" });
    await expect(toolbar.getByRole("button", { name: "Branch" })).toBeDisabled(); // needs a selected shared stop

    // Select Meiji Jingu, branch after it: travelers are dealt into two groups and announced.
    await tree.getByRole("button", { name: /^Meiji Jingu/ }).click();
    const isPhone = (await page.viewportSize())!.width < 1024;
    if (isPhone) { await expect(page.getByRole("dialog")).toBeVisible(); await page.getByRole("dialog").getByRole("button", { name: "Done" }).click(); }
    await toolbar.getByRole("button", { name: "Branch" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Branched after Meiji Jingu into Group A and Group B" })).toHaveCount(1);
    await expect(tree.getByRole("region", { name: "Group A: Joe, Chris" })).toBeVisible();
    await expect(tree.getByRole("region", { name: "Group B: Daniel, Sarah" })).toBeVisible();
    // Empty lanes route straight to the merge stop (Shibuya Sky); an "Add stop" affordance per lane.
    await tree.getByRole("button", { name: "Add stop to Group B" }).click();
    const picker = page.getByRole("dialog", { name: "Add a stop" });
    await picker.getByLabel("Search saved places").fill("pok");
    await picker.getByRole("button", { name: /Pokémon Center Shibuya/ }).click();
    await expect(tree.getByRole("region", { name: "Group B: Daniel, Sarah" }).getByRole("button", { name: /^Pokémon Center Shibuya/ })).toBeVisible();

    // Segment sheet on the new stop: move Chris from A to B, switch the segment to drive.
    await tree.getByRole("region", { name: "Group B: Daniel, Sarah" }).getByRole("button", { name: /^Pokémon Center Shibuya/ }).click();
    const sheet = isPhone ? page.getByRole("dialog") : page.getByRole("region", { name: "Selected segment" });
    await expect(sheet.getByRole("heading", { name: "Meiji Jingu → Pokémon Center Shibuya" })).toBeVisible();
    const who = sheet.getByRole("group", { name: "Who's on this branch" });
    await expect(who.getByRole("checkbox", { name: /Chris/ })).not.toBeChecked();
    await who.getByRole("checkbox", { name: /Chris/ }).check();
    await expect(tree.getByRole("region", { name: "Group B: Chris, Daniel, Sarah" })).toBeVisible();
    await expect(tree.getByRole("region", { name: "Group A: Joe" })).toBeVisible();
    const modes = sheet.getByRole("group", { name: "Mode for this segment" });
    await expect(modes.getByRole("radio", { name: /^Transit/ })).toBeChecked();
    await modes.getByText(/^Drive/).click(); // the radio itself is visually hidden inside its label
    await expect(modes.getByRole("radio", { name: /^Drive · \d+ min/ })).toBeChecked();
    await sheet.getByRole("button", { name: "Done" }).click();
    await expect(tree.getByRole("region", { name: /Group B/ }).getByRole("button", { name: /^Pokémon Center Shibuya: .* · by drive/ })).toBeVisible();
    await expectAccessible(page);

    // Save → URL carries the new route id; reload keeps the tree; the hub lists it.
    await page.getByRole("textbox", { name: "Route name" }).fill("Split afternoon");
    await page.getByRole("button", { name: "Save tree route" }).click();
    await expect(page.getByRole("status").filter({ hasText: 'Saved "Split afternoon".' })).toHaveCount(1);
    await expect(page).toHaveURL(/\/navigate\/tree\?route=[0-9a-f-]{36}$/);
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Route name" })).toHaveValue("Split afternoon");
    await expect(page.getByRole("list", { name: "Route tree" }).getByRole("region", { name: "Group B: Chris, Daniel, Sarah" })).toBeVisible();
    await page.goto("/navigate");
    await expect(page.getByRole("link", { name: /Split afternoon.*Tree route · 2 groups · 7 stops/ })).toBeVisible();
  });

  test("keyboard: nodes are toggle buttons, the segment sheet traps focus and closes with Escape", async ({ authed: page }) => {
    await page.goto(`/navigate/tree?route=${SHIBUYA_TREE}`);
    const isPhone = (await page.viewportSize())!.width < 1024;
    const node = page.getByRole("list", { name: "Route tree" }).getByRole("button", { name: /^Shibuya Sky/ });
    await node.focus();
    await page.keyboard.press("Enter");
    await expect(node).toHaveAttribute("aria-pressed", "true");
    if (isPhone) {
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.locator(":focus")).toHaveCount(1);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    } else {
      await expect(page.getByRole("region", { name: "Selected segment" })).toBeVisible();
    }
    // Unknown route ids are a 404, not someone else's tree.
    const res = await page.goto("/navigate/tree?route=55555555-5555-4555-8555-555555555599");
    expect(res?.status()).toBe(404);
  });

  test("Send my location shares an OpenStreetMap link built from the device position", async ({ authed: page, browserName }) => {
    test.skip(browserName !== "chromium", "clipboard permissions are Chromium-only");
    await page.context().grantPermissions(["geolocation", "clipboard-read", "clipboard-write"]);
    await page.context().setGeolocation({ latitude: 35.6951, longitude: 139.7006 });
    await page.goto("/navigate");
    await page.getByRole("button", { name: /Send my location/ }).click();
    const dialog = page.getByRole("dialog", { name: "Send my location" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("checkbox")).toHaveCount(3);
    await dialog.getByRole("checkbox", { name: "Daniel" }).uncheck();
    await dialog.getByRole("button", { name: "Share my location" }).click();
    await expect(dialog.getByRole("status").filter({ hasText: "Location link copied" })).toContainText("Location link copied — paste it to Chris, Sarah.");
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/^Joe is here \(\d{1,2}:\d{2} [AP]M\): https:\/\/www\.openstreetmap\.org\/\?mlat=35\.69510&mlon=139\.70060#map=17\/35\.69510\/139\.70060$/);
    await expectAccessible(page);
  });
});
