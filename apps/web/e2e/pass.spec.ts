import { CHRIS, expect, expectAccessible, login, test } from "./fixtures";

test.describe("Atlas Premium Pass (round 6)", () => {
  test("Chris (no pass) hits the gate, checks out with the mock provider and lands on Congratulations", async ({ page }) => {
    await login(page, CHRIS.email);
    await page.goto("/split");
    await expect(page.getByRole("heading", { name: "Scan the receipt. Everyone pays their share." })).toBeVisible();
    await page.getByRole("link", { name: "Get Atlas Premium Pass · from $2.99" }).click();
    await expect(page).toHaveURL(/\/pass$/);
    await expect(page.getByRole("heading", { level: 1, name: "Choose your Atlas Premium Pass" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Single trip · Japan 2027, $2.99 one time" })).toBeVisible();
    await expect(page.getByText("Up to 14 days, Mar 15–29. One-time, no renewal.")).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("radio", { name: "Yearly, $49.99 / year" }).click();
    await page.getByRole("radio", { name: "Apple Pay" }).click();
    await page.getByRole("button", { name: "Pay · $49.99" }).click();
    await expect(page).toHaveURL(/\/pass\/done\?e=/);
    await expect(page.getByRole("heading", { level: 1, name: "You have Atlas Premium Pass" })).toBeVisible();
    await expect(page.getByText("Congratulations, Chris")).toBeVisible();
    await expect(page.getByText("Yearly · renews Mar 3, 2028.")).toBeVisible();
    await expect(page.getByText("Apple Pay ·· 4421")).toBeVisible();
    await expect(page.getByText("Sent to chris@example.com")).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("link", { name: "Scan tonight's receipt" }).click();
    await expect(page).toHaveURL(/\/split\/new$/);
    await page.goto("/split");
    await expect(page.getByText(/Yearly · \d+ days left/)).toBeVisible();
    // The pass page now manages instead of selling.
    await page.goto("/pass");
    await expect(page.getByText("Atlas Premium Pass · yearly")).toBeVisible();
    await expect(page.getByText("Renews Mar 3, 2028 · paid with Apple Pay ·· 4421")).toBeVisible();
    await expect(page.getByRole("link", { name: /Gift 3 days/ })).toBeVisible();
    await expectAccessible(page);
  });

  test("Joe gifts Chris 3 days; Chris accepts in another browser, then extends for $0.99", async ({ authed: page, browser }) => {
    test.setTimeout(120_000); // two browsers, three purchases' worth of pages, axe on each
    await page.goto("/pass");
    await page.getByRole("link", { name: /Gift 3 days/ }).click();
    await expect(page).toHaveURL(/\/pass\/gift$/);
    await expect(page.getByRole("heading", { level: 1, name: "Gift 3 days" })).toBeVisible();
    const who = page.getByRole("radiogroup", { name: "Who gets it" });
    await expect(who.getByRole("radio", { name: /Chris Voya account · no pass/ })).toHaveAttribute("aria-checked", "true");
    await expect(who.getByRole("radio", { name: /Daniel Guest · will need to create an account/ })).toBeEnabled();
    await expect(who.getByRole("radio", { name: /Sarah Already has Atlas Premium Pass · yearly/ })).toBeDisabled();
    await expect(page.getByText("When Chris accepts")).toBeVisible();
    await expect(page.getByText("3 days later · midnight Tokyo")).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Send gift to Chris" }).click();
    await expect(page.getByRole("heading", { name: "Gift sent to Chris" })).toBeVisible();
    const url = (await page.getByText(/\/gift\/[a-f0-9]{24}$/).textContent())!.trim();
    expect(url).toMatch(/\/gift\/[a-f0-9]{24}$/);
    // Joe's pass page shows the gift as used; People shows it pending.
    await page.goto("/pass");
    await expect(page.getByText("Gift sent · waiting for Chris")).toBeVisible();
    await expect(page.getByText("You've used this trip's gift.")).toBeVisible();

    // Chris, in a fresh browser, opens the link, signs in and accepts.
    const ctx = await browser.newContext();
    const chris = await ctx.newPage();
    await chris.goto(url);
    await expect(chris.getByRole("heading", { level: 1, name: "3 days of Atlas Premium Pass" })).toBeVisible();
    await expect(chris.getByText("A gift from Joe")).toBeVisible();
    await expect(chris.getByText("Full Atlas Premium Pass · 3 days")).toBeVisible();
    await expectAccessible(chris);
    await chris.getByRole("link", { name: "Log in" }).click();
    await chris.getByLabel("Email").fill(CHRIS.email);
    await chris.getByLabel("Password").fill(CHRIS.password);
    await chris.getByRole("button", { name: "Log in" }).click();
    await expect(chris).toHaveURL(/\/gift\//);
    await chris.getByRole("button", { name: "Accept gift as Chris" }).click();
    await expect(chris).toHaveURL(/\/pass\/done\?e=/);
    await expect(chris.getByText("Gift accepted, Chris")).toBeVisible();
    await expect(chris.getByText(/Gifted · ends .* 11:59 PM/)).toBeVisible();
    await expect(chris.getByText("Nothing to pay")).toBeVisible();
    await chris.goto("/split");
    await expect(chris.getByText(/Gifted · \d days left/)).toBeVisible(); // 3 days + the rest of today, trip time
    // The link is used up now.
    await chris.goto(url);
    await expect(chris.getByRole("heading", { name: "This gift was already accepted" })).toBeVisible();

    // Extend: 7 days for $0.99.
    await chris.goto("/pass/extend");
    await expect(chris.getByRole("heading", { level: 2, name: /Your gifted pass ends/ })).toBeVisible();
    await expect(chris.getByText(/7 days covers you through/)).toBeVisible();
    await expect(chris.getByText(/≈ ¥\d+/)).toBeVisible();
    await expectAccessible(chris);
    await chris.getByRole("radio", { name: "5 days" }).click();
    await expect(chris.getByText("Extension · 5 days")).toBeVisible();
    await chris.getByRole("button", { name: "Pay · $0.99" }).click();
    await expect(chris).toHaveURL(/\/pass\/done\?e=/);
    await expect(chris.getByText(/Extended · ends/)).toBeVisible();
    await expect(chris.getByText("Card ·· 4421")).toBeVisible();
    await chris.goto("/split");
    await expect(chris.getByText(/Extended · \d days left/)).toBeVisible();
    await ctx.close();

    // Back with Joe: People shows Chris accepted, with the ring on his avatar.
    await page.goto("/trips/22222222-2222-4222-8222-222222222221/people");
    await expect(page.getByText(/Gifted · Chris accepted/)).toBeVisible();
  });

  test("redeem by code validates, and the gift page explains a dead code", async ({ authed: page }) => {
    await page.goto("/pass?redeem=1");
    await page.getByLabel("Gift code").fill("not-a-code");
    await page.getByRole("button", { name: "Redeem" }).click();
    await expect(page).toHaveURL(/error=code/);
    await expect(page.getByRole("alert").filter({ hasText: "gift code" })).toContainText("That doesn't look like a gift code");
    await expectAccessible(page);
    await page.goto("/gift/000000000000000000000000");
    await expect(page.getByRole("heading", { name: "This gift isn't active" })).toBeVisible();
  });
});
