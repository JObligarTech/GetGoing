import { expect, expectAccessible, test } from "./fixtures";

const TRIP = "22222222-2222-4222-8222-222222222221";

test.describe("People (round 5)", () => {
  test("lists everyone with how they show up, adds a guest, edits, invites by link, removes", async ({ authed: page, browserName }) => {
    await page.goto(`/trips/${TRIP}`);
    await page.getByRole("link", { name: "Add traveler Guests don't need an account" }).click();
    await expect(page).toHaveURL(`/trips/${TRIP}/people`);
    await expect(page.getByRole("heading", { level: 1, name: "People · 4" })).toBeVisible();
    await expect(page.getByText("You · Organizer · All 14 nights · Home USD")).toBeVisible();
    await expect(page.getByText("Guest · Tokyo only, Mar 15–20 · Home CAD")).toBeVisible();
    await expect(page.getByText("Guest · All 14 nights · +1 415 555 0142")).toBeVisible();
    // Groups come from the tree route.
    await expect(page.getByText(/Used in .Shibuya afternoon. route/)).toHaveCount(2);
    await expect(page.getByRole("img", { name: "Joe, Sarah" })).toBeVisible();
    await expectAccessible(page);

    // Add a guest: a name is enough; joining dates are optional.
    await page.getByRole("button", { name: "Add traveler" }).click();
    const dialog = page.getByRole("dialog", { name: "Add traveler" });
    await dialog.getByLabel("Name").fill("Maya Chen");
    await dialog.getByLabel("Home currency (optional)").fill("sgd");
    await dialog.getByText("Some days").click(); // the radio itself is visually hidden; its label is the target
    await dialog.getByLabel("From").fill("2027-03-20");
    await dialog.getByLabel("To").fill("2027-03-24");
    await dialog.getByLabel("Where (optional)").fill("Kyoto only");
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Add to Japan 2027" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Added Maya Chen to Japan 2027." })).toHaveCount(1);
    await expect(page.getByText("Guest · Kyoto only, Mar 20–24 · Home SGD")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "People · 5" })).toBeVisible();

    // Invite: the link is shared (clipboard on desktop) and the row shows it was sent.
    if (browserName === "chromium" && (await page.viewportSize())!.width >= 1024) {
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.getByRole("button", { name: "Invite Maya Chen" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Invite link for Maya copied" })).toHaveCount(1);
      const text = await page.evaluate(() => navigator.clipboard.readText());
      expect(text).toMatch(/Joe added you to "Japan 2027" on Voya.*\/join\/[a-f0-9]{36}/s);
      await expect(page.getByRole("button", { name: "Share invite link again for Maya Chen" })).toBeVisible();
      // The public join page shows the trip and who asked; a signed-in demo user just goes home.
      const url = text.match(/https?:\/\/\S+\/join\/[a-f0-9]{36}/)![0];
      await page.goto(url);
      await expect(page.getByRole("heading", { level: 1, name: "Japan 2027" })).toBeVisible();
      await expect(page.getByText("Joe invited you as Maya Chen")).toBeVisible();
      await expect(page.getByRole("button", { name: "Join as Joe" })).toBeVisible();
      await expectAccessible(page);
      await page.goto(`/trips/${TRIP}/people`);
    }

    // Edit and remove a guest; account holders can't be removed here.
    await page.getByRole("button", { name: "Edit Maya Chen" }).click();
    const edit = page.getByRole("dialog", { name: "Edit traveler" });
    await edit.getByLabel("Name").fill("Maya C.");
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Maya C.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Edit Maya C." }).click();
    await page.getByRole("dialog", { name: "Edit traveler" }).getByRole("button", { name: "Remove" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Removed Maya C." })).toHaveCount(1);
    await expect(page.getByRole("button", { name: /Edit Joe Obligar/ })).toHaveCount(0);
  });

  test("an unknown invite link says so without leaking anything", async ({ page }) => {
    const res = await page.goto("/join/000000000000000000000000000000000000");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "This invite isn't active" })).toBeVisible();
    await expectAccessible(page);
  });
});
