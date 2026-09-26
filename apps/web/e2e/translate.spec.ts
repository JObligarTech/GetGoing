import { expect, expectAccessible, test } from "./fixtures";

const HOTEL = "44444444-4444-4444-8444-444444444441";
// 1×1 PNG: the mock OCR ignores pixels, the action only checks type and size.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test.describe("Translate (round 4)", () => {
  test("text mode: trip language suggested, auto-translate, speak/copy/save, saved phrases, swap", async ({ authed: page, browserName }) => {
    await page.goto("/tools");
    await page.getByRole("link", { name: /Translate.*日本語 ready/ }).click();
    await expect(page).toHaveURL(/\/translate$/);
    await expect(page.getByRole("heading", { level: 1, name: "Translate" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "From", exact: true })).toHaveValue("en");
    await expect(page.getByRole("combobox", { name: "To", exact: true })).toHaveValue("ja");
    await expect(page.getByText("Suggested for Japan")).toBeVisible();
    // Seeded, trip-scoped phrases.
    const saved = page.getByRole("region", { name: "Saved phrases" }).filter({ visible: true });
    for (const name of ["Where is the station?", "No peanuts, please", "Table for four"]) await expect(saved.getByRole("button", { name })).toBeVisible();
    await expectAccessible(page);

    // Typing translates after a pause; the result card carries the romanisation.
    const box = page.getByRole("textbox", { name: "Text to translate" });
    await box.fill("Where is the entrance?");
    const result = page.getByRole("region", { name: "Translation to Japanese" });
    await expect(result).toContainText("入口はどこですか？");
    await expect(result).toContainText("Iriguchi wa doko desu ka?");
    await expect(page.getByText("22 / 500")).toBeVisible();
    await expectAccessible(page);

    if (browserName === "chromium" && (await page.viewportSize())!.width >= 1024) {
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await result.getByRole("button", { name: "Copy" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Copied to clipboard" })).toHaveCount(1);
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("入口はどこですか？");
    }

    // Save → chip appears, survives a reload (server state), can be removed from the result card.
    await result.getByRole("button", { name: "Save phrase" }).click();
    await expect(page.getByRole("status").filter({ hasText: 'Saved "Where is the entrance?" to Japan 2027.' })).toHaveCount(1);
    await expect(saved.getByRole("button", { name: "Where is the entrance?" })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.getByRole("region", { name: "Saved phrases" }).filter({ visible: true }).getByRole("button", { name: "Where is the entrance?" })).toBeVisible();
    // A saved chip loads the phrase and its translation without a network round-trip.
    await page.getByRole("region", { name: "Saved phrases" }).filter({ visible: true }).getByRole("button", { name: "No peanuts, please" }).click();
    await expect(page.getByRole("textbox", { name: "Text to translate" })).toHaveValue("No peanuts, please");
    await expect(page.getByRole("region", { name: "Translation to Japanese" })).toContainText("ピーナッツ抜きでお願いします");
    await page.getByRole("region", { name: "Translation to Japanese" }).getByRole("button", { name: "Remove from saved" }).click();
    await expect(page.getByRole("status").filter({ hasText: 'Removed "No peanuts, please".' })).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Saved phrases" }).filter({ visible: true }).getByRole("button", { name: "No peanuts, please" })).toHaveCount(0);

    // Swap moves the translation into the source box and flips the pair.
    await page.getByRole("button", { name: "Swap languages" }).click();
    await expect(page.getByRole("combobox", { name: "From", exact: true })).toHaveValue("ja");
    await expect(page.getByRole("combobox", { name: "To", exact: true })).toHaveValue("en");
    await expect(page.getByRole("textbox", { name: "Text to translate" })).toHaveValue("ピーナッツ抜きでお願いします");
    await expect(page.getByRole("region", { name: "Translation to English" })).toContainText("No peanuts, please");

    // Outside the offline phrasebook the demo says so instead of inventing a translation.
    await page.getByRole("button", { name: "Swap languages" }).click();
    await page.getByRole("textbox", { name: "Text to translate" }).fill("Purple monkey dishwasher");
    await expect(page.getByRole("note")).toContainText("Demo mode");
    await expect(page.getByRole("button", { name: "Save phrase" })).toBeDisabled();
  });

  test("From your trip: hotel → Show to driver card; next place → phrase; keyboard reaches every control", async ({ authed: page }) => {
    await page.goto("/translate");
    const aside = page.getByRole("complementary", { name: "From your trip" });
    await expect(aside.getByRole("link", { name: /My hotel address/ })).toHaveAttribute("href", `/translate/driver?place=${HOTEL}`);
    await expect(aside.getByRole("link", { name: /Afuri Ramen Harajuku name & address/ })).toBeVisible();
    await aside.getByRole("button", { name: /Shibuya Sky: "Where is the entrance\?"/ }).click();
    await expect(page.getByRole("region", { name: "Translation to Japanese" })).toContainText("入口はどこですか？");

    await aside.getByRole("link", { name: /My hotel address/ }).click();
    await expect(page).toHaveURL(/\/translate\/driver\?place=/);
    const card = page.getByRole("region", { name: "Card for the driver" });
    await expect(card).toContainText("ここまでお願いします");
    await expect(card).toContainText("ホテルグレイスリー新宿");
    await expect(card).toContainText("〒160-8466 東京都新宿区歌舞伎町1-19-1");
    await expect(card).toContainText("Hotel Gracery Shinjuku");
    await expect(card.locator("[lang=ja]").first()).toBeVisible();
    await page.getByRole("button", { name: "Enlarge" }).click();
    await expect(page.getByRole("button", { name: "Smaller" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("link", { name: "Show map" })).toHaveAttribute("href", `/navigate/route?to=${HOTEL}&mode=drive`);
    await expectAccessible(page);
    // Unknown place → 404, not another trip's data.
    expect((await page.goto("/translate/driver?place=44444444-4444-4444-8444-444444444499"))?.status()).toBe(404);

    // Keyboard: From → swap → To → textarea → Speak → Translate, in reading order.
    await page.goto("/translate");
    await page.getByRole("combobox", { name: "From", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Swap languages" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("combobox", { name: "To", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("textbox", { name: "Text to translate" })).toBeFocused();
    await page.keyboard.type("Thank you");
    await page.keyboard.press("Control+Enter");
    await expect(page.getByRole("region", { name: "Translation to Japanese" })).toContainText("ありがとうございます");
  });

  test("conversation mode: their half faces them in 日本語; typed turns translate both ways", async ({ authed: page }) => {
    await page.goto("/translate");
    await page.getByRole("navigation", { name: "Translate modes" }).getByRole("link", { name: "Conversation" }).click();
    await expect(page).toHaveURL(/\/translate\/conversation$/);
    const theirs = page.getByRole("region", { name: "Japanese side, facing the other person" });
    await expect(theirs).toHaveAttribute("lang", "ja");
    await expect(theirs).toContainText("タップして話す");
    await expect(theirs.getByRole("button", { name: /話す \(Japanese\)/ })).toBeVisible();
    await expect(page.getByRole("switch", { name: /Auto-detect on/ })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("English ⇄ 日本語")).toBeVisible();
    await expectAccessible(page);

    // Headless Chromium has no microphone: the mic either reports why or starts listening (and can be stopped); the typed fallback always works.
    await page.getByRole("region", { name: "English side" }).getByRole("button", { name: /Speak \(English\)/ }).click();
    const mic = page.getByRole("alert").filter({ hasText: /Microphone|Couldn't hear|Voice input/ }).or(page.getByRole("button", { name: "Stop listening (English)" }));
    await expect(mic.first()).toBeVisible();
    // If it did start listening, stop it; the engine may also give up on its own, so don't insist.
    await page.getByRole("button", { name: "Stop listening (English)" }).click({ timeout: 2000 }).catch(() => {});
    const input = page.getByRole("textbox", { name: "Type instead" });
    await input.fill("Where is the station?");
    await page.keyboard.press("Enter");
    await expect(theirs).toContainText("駅はどこですか？");
    await expect(theirs).toContainText("Eki wa doko desu ka?");
    // Auto-detect: Japanese text is treated as their turn and comes back in English on my side.
    await input.fill("ありがとうございます");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("region", { name: "English side" })).toContainText("Thank you");
    const transcript = page.getByRole("region", { name: "Transcript" });
    await expect(transcript.getByRole("listitem")).toHaveCount(2);
    await expect(transcript.getByRole("listitem").nth(1)).toContainText(/^Japanese/);
    await expectAccessible(page);
    await page.getByRole("link", { name: "Close" }).click();
    await expect(page).toHaveURL(/\/translate$/);
  });

  test("camera: a photo is read into overlay chips with prices in both currencies; text view; Split is off until round 5", async ({ authed: page }) => {
    await page.goto("/translate/camera");
    await expect(page.getByRole("heading", { level: 1, name: "Camera" })).toBeVisible();
    await expect(page.getByText("日本語 → English")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send to Split" })).toBeDisabled();
    await expectAccessible(page);

    // "Choose photo" opens a real file input (hidden); the tiny PNG goes through the size/type checks.
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Choose photo" }).click()]);
    await chooser.setFiles({ name: "menu.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByRole("status").filter({ hasText: "Found 6 lines. 4 have prices." })).toHaveCount(1);
    const overlay = page.getByRole("list", { name: "Translated lines over the photo" });
    await expect(overlay.getByRole("listitem").filter({ hasText: "Yuzu Shio Ramen" })).toContainText("¥1,200 ≈ $8.02");
    await expect(overlay.getByRole("listitem").filter({ hasText: "Gyoza, 5 pcs" })).toContainText("¥600");
    await expect(overlay.getByRole("listitem").filter({ hasText: "Contains wheat, soy and egg" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Your photo" })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("radio", { name: "Text" }).click();
    const text = page.getByRole("region", { name: "Translated text" });
    await expect(text).toContainText("Tsukemen (dipping noodles)");
    await expect(text).toContainText("小麦・大豆・卵を含む · low confidence");
    await expectAccessible(page);

    // Wrong file type is refused before it reaches the OCR provider.
    const [chooser2] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Choose photo" }).click()]);
    await chooser2.setFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.getByRole("alert").filter({ hasText: "isn't a photo we can read" })).toBeVisible();

    // The sample menu works without a camera at all.
    await page.getByRole("button", { name: "Try a sample menu" }).click();
    await expect(page.getByRole("img", { name: /Sample menu from Afuri Ramen/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Translated text" })).toContainText("Extra chashu");
  });

  test("place page links to Show to driver and to a ready-made question", async ({ authed: page }) => {
    await page.goto(`/plan/place/${HOTEL}`);
    await expect(page.getByRole("link", { name: /Show to driver/ })).toHaveAttribute("href", `/translate/driver?place=${HOTEL}`);
    await page.getByRole("link", { name: /Ask for Hotel/ }).click();
    await expect(page).toHaveURL(/\/translate\?text=/);
    await expect(page.getByRole("textbox", { name: "Text to translate" })).toHaveValue("Where is Hotel Gracery Shinjuku?");
  });
});
