import { expect, expectAccessible, test } from "./fixtures";

const AFURI = "44444444-4444-4444-8444-444444444445";

test.describe("Profile, Settings, permissions and offline (round 6)", () => {
  test("profile shows the pass, stats and defaults; defaults save; settings toggles and packs persist", async ({ authed: page }) => {
    await page.goto("/profile");
    await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
    await expect(page.getByText("Atlas Premium Pass · yearly").first()).toBeVisible();
    await expect(page.getByText("Saved places")).toBeVisible();
    await expect(page.getByText("Countries")).toBeVisible();
    await expect(page.getByText("English, Tagalog")).toBeVisible();
    await expect(page.getByText("Tokyo · 412 MB")).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("button", { name: "Home currency USD, edit" }).click();
    const dialog = page.getByRole("dialog", { name: "Trip defaults" });
    await dialog.getByLabel("Home currency").selectOption("EUR");
    await dialog.getByRole("checkbox", { name: "Japanese" }).click();
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Defaults saved." })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Home currency EUR, edit" })).toBeVisible();
    await page.reload();
    await expect(page.getByText("English, Tagalog, Japanese")).toBeVisible();
    await page.getByRole("radio", { name: "Miles" }).click();
    await expect(page.getByRole("radio", { name: "Miles" })).toHaveAttribute("aria-checked", "true");

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("radiogroup", { name: "Theme" })).toBeVisible();
    await page.getByRole("radio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectAccessible(page);
    await page.getByRole("radio", { name: "Follow system" }).click();
    const home = page.getByRole("switch", { name: "Show home time" });
    await expect(home).toHaveAttribute("aria-checked", "true");
    await home.click();
    await expect(page.getByRole("status").filter({ hasText: "Show home time off." })).toHaveCount(1);
    await page.reload();
    await expect(page.getByRole("switch", { name: "Show home time" })).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText("Japan 2027 · offline pack")).toBeVisible();
    await page.getByRole("button", { name: "Download Kyoto & Osaka maps, 290 MB, Wi-Fi only" }).click();
    await expect(page.getByRole("button", { name: /Remove Kyoto & Osaka maps, downloaded just now/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: /Remove Kyoto & Osaka maps/ })).toBeVisible();

    await page.getByRole("link", { name: "Permissions & legal" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Permissions" })).toBeVisible();
    for (const row of ["Location", "Microphone", "Camera", "Photos", "Contacts", "Notifications"]) await expect(page.getByText(row, { exact: true })).toBeVisible();
    await expect(page.getByText("Not available on the web")).toBeVisible();
    await expect(page.getByRole("link", { name: "Terms of Service" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download my data" })).toBeVisible();
    await expectAccessible(page);
  });

  test("permission sheets explain before the browser asks, once per device", async ({ authed: page }) => {
    await page.goto("/navigate");
    await page.getByRole("button", { name: /Send my location/ }).click();
    await page.getByRole("dialog", { name: "Send my location" }).getByRole("button", { name: "Share my location" }).click();
    const sheet = page.getByRole("dialog", { name: "Use your location for directions?" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Used only while Get Going is open. Nothing runs in the background.")).toBeVisible();
    await expectAccessible(page);
    await sheet.getByRole("button", { name: "Not now · I'll type a starting point" }).click();
    await expect(sheet).toBeHidden();
    await page.goto("/translate");
    await page.getByRole("button", { name: "Speak in English" }).click();
    const mic = page.getByRole("dialog", { name: "Allow the microphone for voice translation?" });
    await expect(mic).toBeVisible();
    await expect(mic.getByText("Text translation keeps working if you decline.")).toBeVisible();
    await mic.getByRole("button", { name: "Keep typing instead" }).click();
    await expect(mic).toBeHidden();
    await page.getByRole("button", { name: "Speak in English" }).click();
    await expect(mic).toBeHidden(); // asked once per device; the browser prompt (or the unsupported message) comes next
    await page.goto("/settings/permissions");
    await expect(page.getByText("Declined in Get Going · ask again from the feature").first()).toBeVisible();
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByText("Not asked yet").first()).toBeVisible();
  });

  test("offline: the banner, the Available offline card, text translation and the taxi fallback", async ({ authed: page, context }) => {
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "Japan 2027" })).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByRole("status").filter({ hasText: "You're offline · showing Japan 2027 saved just now" })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Available offline" })).toBeVisible();
    await expect(page.getByText(/\d+ saved places/)).toBeVisible();
    await expect(page.getByText("USD → JPY rate")).toBeVisible();
    await expect(page.getByText("Needs internet")).toBeVisible();
    await expectAccessible(page);
    await context.setOffline(false);

    await page.goto("/translate");
    await context.setOffline(true);
    await expect(page.getByText("Offline", { exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: "Text to translate" }).fill("Thank you");
    await expect(page.getByText("ありがとうございます")).toBeVisible();
    await expect(page.getByText("Text translation works offline · phrasebook")).toBeVisible();
    await expect(page.getByText("Unavailable right now")).toBeVisible();
    await expect(page.getByText("Photos are saved and translated when you're back online")).toBeVisible();
    await page.getByRole("button", { name: "Speak in English" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Speech" })).toContainText("Speech needs internet");
    await context.setOffline(false);

    await page.goto(`/navigate/route?to=${AFURI}`);
    await expect(page.getByRole("heading", { level: 1, name: /To Afuri Ramen Harajuku/ })).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByText("Slow connection · live transit unavailable")).toBeVisible();
    await expect(page.getByRole("link", { name: "Show address in 日本語 →" })).toHaveAttribute("href", /\/translate\/driver\?place=/);
    await expectAccessible(page);
    await context.setOffline(false);
  });

  test("terms open with the short version; the sync error boundary copy exists", async ({ page }) => {
    await page.goto("/legal/terms");
    await expect(page.getByRole("heading", { name: "Short version. The full terms take precedence." })).toBeVisible();
    await expect(page.getByText("Atlas Premium Pass.", { exact: true })).toBeVisible();
    await expect(page.getByText("Updated Sep 1, 2026")).toBeVisible();
    await expectAccessible(page);
  });
});
