import { expect, expectAccessible, test } from "./fixtures";

test.describe("Currency (round 4)", () => {
  test("home → trip currency with the mock rate, quick amounts, keypad, swap, tip and percent off", async ({ authed: page }) => {
    await page.goto("/tools");
    await page.getByRole("link", { name: /Currency.*USD ⇄ JPY/ }).click();
    await expect(page).toHaveURL(/\/currency$/);
    await expect(page.getByRole("heading", { level: 1, name: "Currency" })).toBeVisible();
    await expect(page.getByText("USD · Home")).toBeVisible();
    await expect(page.getByText("JPY · Japan · local")).toBeVisible();
    const amount = page.getByRole("textbox", { name: "Amount in US Dollar" });
    await expect(amount).toHaveValue("100");
    await expect(page.getByText("¥14,970", { exact: true })).toBeVisible(); // 100 × 149.7
    await expect(page.getByText("1 USD = 149.70 JPY · mid-market")).toBeVisible();
    await expect(page.getByText("Updated 2 min ago")).toBeVisible(); // demo "now" vs the mock's asOf
    await expectAccessible(page);

    // Quick amounts, then the keypad appends digits and backspace removes them.
    await page.getByRole("group", { name: "Quick amounts" }).getByRole("button", { name: "$20.00" }).click();
    await expect(amount).toHaveValue("20");
    await expect(page.getByText("¥2,994", { exact: true })).toBeVisible();
    const keypad = page.getByRole("group", { name: "Keypad" });
    await keypad.getByRole("button", { name: "5", exact: true }).click();
    await expect(amount).toHaveValue("205");
    await keypad.getByRole("button", { name: "Backspace" }).click();
    await keypad.getByRole("button", { name: "Decimal point" }).click();
    await keypad.getByRole("button", { name: "5", exact: true }).click();
    await expect(amount).toHaveValue("20.5");
    await expect(page.getByText("¥3,069", { exact: true })).toBeVisible(); // 20.5 × 149.7 = 3068.85 → whole yen

    // Tip and % off adjust the source amount and say so.
    await keypad.getByRole("button", { name: "Add a tip" }).click();
    await page.getByRole("group", { name: "Tip presets" }).getByRole("button", { name: "15%" }).click();
    await expect(page.getByText("+ 15% tip = $23.58")).toBeVisible();
    await expect(page.getByText("¥3,530", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Remove adjustment" }).click();
    await keypad.getByRole("button", { name: /Take a percentage off/ }).click();
    await page.getByRole("group", { name: "Percent off presets" }).getByRole("button", { name: "10%" }).click();
    await expect(page.getByText("− 10% off = $18.45")).toBeVisible();
    await expectAccessible(page);

    // Swap: the converted amount becomes the input, currencies flip, adjustments clear.
    await page.getByRole("button", { name: "Swap currencies" }).click();
    await expect(page.getByText("JPY · Japan · local")).toBeVisible();
    await expect(page.getByText("USD · Home")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Amount in Japanese Yen" })).toHaveValue("2762");
    await expect(page.getByText("1 JPY = 0.0067 USD · mid-market")).toBeVisible();
    await expect(page.getByText("$18.45", { exact: true })).toBeVisible();
    // Yen has no decimals: the decimal key is a no-op.
    await keypad.getByRole("button", { name: "Decimal point" }).click();
    await expect(page.getByRole("textbox", { name: "Amount in Japanese Yen" })).toHaveValue("2762");
  });

  test("trip currencies: the Seoul layover chip converts to KRW; add and remove a currency; common prices; save on device", async ({ authed: page }) => {
    await page.goto("/currency");
    const chips = page.getByRole("radiogroup", { name: "Trip currencies" });
    await expect(chips.getByRole("radio", { name: "JPY" })).toBeChecked();
    await chips.getByRole("radio", { name: "KRW · Seoul layover" }).click();
    await expect(page.getByText("KRW · KRW · Seoul layover")).toBeVisible();
    await expect(page.getByText("₩134,200", { exact: true })).toBeVisible(); // 100 × 1342
    await expect(page.getByText("1 USD = 1,342.00 KRW · mid-market")).toBeVisible();

    // Add a currency through the dialog (server state: survives reload), then remove it.
    await page.getByRole("button", { name: "Add currency" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Add a currency" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Currency").selectOption("EUR");
    await dialog.getByLabel("Note (optional)").fill("Paris stopover");
    await dialog.getByRole("button", { name: "Add" }).click();
    await expect(dialog).toBeHidden();
    await expect(chips.getByRole("radio", { name: "EUR · Paris stopover" })).toBeChecked();
    await expect(page.getByText("€92.00", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("radiogroup", { name: "Trip currencies" }).getByRole("radio", { name: "EUR · Paris stopover" })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Remove EUR" }).click();
    await expect(page.getByRole("status").filter({ hasText: "EUR removed." })).toHaveCount(1);
    await expect(page.getByRole("radiogroup", { name: "Trip currencies" }).getByRole("radio", { name: "EUR · Paris stopover" })).toHaveCount(0);

    // Reference prices in the trip's currency with the home equivalent.
    const common = page.getByRole("region", { name: "Common in Japan" }).filter({ visible: true });
    await expect(common).toContainText("Ramen bowl");
    await expect(common).toContainText("¥1,200 ≈ $8.02");
    await expect(common).toContainText("Shibuya Sky ticket");

    // Save keeps the pair on this device only.
    await page.getByRole("group", { name: "Keypad" }).getByRole("button", { name: "Save this amount" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved $100.00 = ¥14,970 on this device." })).toHaveCount(1);
    const savedList = page.getByRole("region", { name: "Saved on this device" }).filter({ visible: true });
    await expect(savedList).toContainText("$100.00");
    await page.reload();
    await expect(page.getByRole("region", { name: "Saved on this device" }).filter({ visible: true })).toContainText("= ¥14,970");
    await page.getByRole("button", { name: "Remove saved $100.00" }).first().click();
    await expect(page.getByRole("region", { name: "Saved on this device" })).toHaveCount(0);
  });

  test("keyboard: the amount is a real input; the keypad and chips are reachable; rates re-fetch when the pair changes", async ({ authed: page }) => {
    await page.goto("/currency");
    const amount = page.getByRole("textbox", { name: "Amount in US Dollar" });
    await amount.focus();
    await page.keyboard.type("50");
    await expect(page.getByText("¥7,485", { exact: true })).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Swap currencies" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("textbox", { name: "Amount in Japanese Yen" })).toHaveValue("7485");
    await expect(page.getByText("$50.00", { exact: true })).toBeVisible();
    // Rates land for the KRW chip too (a second pair through the server cache).
    await page.getByRole("radiogroup", { name: "Trip currencies" }).getByRole("radio", { name: "KRW · Seoul layover" }).click();
    await expect(page.getByText("1 JPY = 8.9646 KRW · mid-market")).toBeVisible();
    await expectAccessible(page);
  });
});
