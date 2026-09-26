import { expect, expectAccessible, test } from "./fixtures";

const AFURI_BILL = "99999999-9999-4999-8999-999999999991";
const AFURI_PLACE = "44444444-4444-4444-8444-444444444445";
const CHRIS_TOKEN = "k8fq2demo0000000000000000chris01";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test.describe("Split (round 5)", () => {
  test("hub: pass active, tonight's dinner prefilled, the open bill and past splits", async ({ authed: page }) => {
    await page.goto("/tools");
    await page.getByRole("link", { name: /Split.*friends claim by link/ }).click();
    await expect(page).toHaveURL(/\/split$/);
    await expect(page.getByRole("heading", { level: 1, name: "Split" })).toBeVisible();
    await expect(page.getByText(/Yearly · \d+ days left/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Scan a receipt.*Afuri Ramen Harajuku · tonight's dinner · JPY · 4 people from your trip/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Afuri Ramen Harajuku, ¥6,655, 4 people, open" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Past splits" }).or(page.getByText("Time Out Market"))).toBeVisible();
    await expectAccessible(page);
  });

  test("results of the seeded bill match the maths; claim states; share; close and reopen", async ({ authed: page, browserName }) => {
    await page.goto(`/split/${AFURI_BILL}?step=3`);
    await expect(page.getByRole("heading", { level: 1, name: "Afuri Ramen Harajuku" })).toBeVisible();
    await expect(page.getByText("Step 3 of 3 · Everyone's share")).toBeVisible();
    const results = page.getByRole("region", { name: "Everyone's share" });
    await expect(results.getByText("¥6,655", { exact: true })).toBeVisible();
    await expect(results.getByText("≈ $44.46")).toBeVisible();
    const shares = page.getByRole("list", { name: "Shares" });
    await expect(shares.getByRole("listitem", { name: /^Joe: ¥2,431, about \$16\.24, paid/ })).toBeVisible();
    await expect(shares.getByRole("listitem", { name: /^Chris: ¥1,824, about \$12\.18/ })).toContainText("Claimed");
    await expect(shares.getByRole("listitem", { name: /^Daniel: ¥774, about CA\$7\.0\d/ })).toContainText("Link opened");
    await expect(shares.getByRole("listitem", { name: /^Sarah: ¥1,326/ })).toBeVisible();
    await expect(page.getByText("Collects ¥3,924 from 3 people")).toBeVisible();
    await expect(page.getByRole("note")).toContainText("¥300 is still unassigned (Coke)");
    await expectAccessible(page);

    if (browserName === "chromium" && (await page.viewportSize())!.width >= 1024) {
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.getByRole("button", { name: "Share" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Summary copied" })).toHaveCount(1);
      const text = await page.evaluate(() => navigator.clipboard.readText());
      expect(text).toContain("Joe: ¥2,431 (≈ $16.24) — ½ Yuzu Shio Ramen, ½ Gyoza, ½ Draft beer (paid)");
      expect(text).toContain("Split doesn't move money");
    }
    await page.getByRole("button", { name: "Close bill" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Bill closed" })).toHaveCount(1);
    await expect(page.getByText("Settled", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Reopen bill" }).click();
    await expect(page.getByRole("button", { name: "Close bill" })).toBeVisible();
  });

  test("scan → correct the flagged line → assign with avatars → calculate → claim link works without an account", async ({ authed: page, browserName, context }) => {
    test.setTimeout(120_000); // four screens, four axe passes and a second browser context
    // Start from the restaurant's page: merchant and people are prefilled.
    await page.goto(`/plan/place/${AFURI_PLACE}`);
    await page.getByRole("link", { name: /Split a bill here/ }).click();
    await expect(page).toHaveURL(new RegExp(`/split/new\\?place=${AFURI_PLACE}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Scan receipt" })).toBeVisible();
    await expect(page.getByText("Afuri Ramen Harajuku", { exact: true })).toBeVisible();
    await expect(page.getByText("4 people from your trip")).toBeVisible();
    await expectAccessible(page);
    // A real file input takes the photo; the mock OCR reads the fixture receipt.
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Choose photo" }).click()]);
    await chooser.setFiles({ name: "receipt.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText("1 page ready")).toBeVisible();
    await page.getByRole("button", { name: "Read the receipt" }).click();
    await expect(page).toHaveURL(/\/split\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    // Step 1: five items, the misread つけ麹 flagged, totals from the receipt.
    await expect(page.getByText("Step 1 of 3 · Check items")).toBeVisible();
    await expect(page.getByText("1 line looks uncertain.")).toBeVisible();
    const items = page.getByRole("list", { name: "Items" });
    await expect(items.getByRole("listitem")).toHaveCount(5);
    await expect(items.getByRole("textbox", { name: "Item name" }).first()).toHaveValue("Yuzu Shio Ramen");
    await expect(page.getByText(/low confidence · read as "つけ麹"/)).toBeVisible();
    const check = page.getByRole("region", { name: "Check items" });
    await expect(check.getByText("¥6,655", { exact: true })).toBeVisible();
    await expectAccessible(page);
    // Fix the flagged line by hand, then add a missing item for two people.
    await items.getByRole("textbox", { name: "Item name" }).last().fill("Tsukemen");
    await page.getByRole("button", { name: "Add missing line" }).click();
    const add = page.getByRole("dialog", { name: "Add item by hand" });
    await add.getByLabel("Item").fill("Edamame");
    await add.getByLabel("Price (JPY)").fill("450");
    await add.getByRole("checkbox", { name: "Joe" }).click();
    await add.getByRole("checkbox", { name: "Sarah" }).click();
    await add.getByRole("button", { name: "Add · Joe & Sarah" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Added Edamame · ¥450 · Joe & Sarah." })).toHaveCount(1);
    await expect(items.getByRole("listitem")).toHaveCount(6);
    await expect(check.getByText("¥7,105", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Looks right · Add people" }).click();

    // Step 2: tap avatars; split the rest evenly; send Chris a claim link.
    await expect(page.getByText("Step 2 of 3 · Who had what")).toBeVisible();
    const assign = page.getByRole("list", { name: "Items to assign" });
    const ramen = assign.getByRole("listitem").filter({ hasText: "Yuzu Shio Ramen" });
    await ramen.getByRole("checkbox", { name: "Joe" }).click();
    await ramen.getByRole("checkbox", { name: "Sarah" }).click();
    await expect(ramen).toContainText("Shared by 2 · ¥1,200 each");
    await expect(page.getByText(/^¥2,850 · ¥3,650 left/)).toBeVisible();
    await page.getByRole("button", { name: "Split rest evenly" }).click();
    await expect(page.getByText(/^¥6,500 · ¥0 left/)).toBeVisible();
    await expectAccessible(page);
    let claimUrl: string | null = null;
    if (browserName === "chromium") {
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.getByRole("radio", { name: /^Chris/ }).click();
      await page.getByRole("button", { name: "Send link" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Claim link for Chris copied" })).toHaveCount(1);
      claimUrl = (await page.evaluate(() => navigator.clipboard.readText())).trim();
      expect(claimUrl).toMatch(/\/s\/[a-f0-9]{32}$/);
    }
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Step 3 of 3 · Everyone's share")).toBeVisible();
    await expect(page.getByRole("list", { name: "Shares" }).getByRole("listitem")).toHaveCount(4);
    await expect(page.getByRole("note")).toHaveCount(0); // nothing unassigned

    // The claim page needs no session: a fresh context opens it, Chris changes his picks, the bill updates.
    if (claimUrl) {
      const guest = await context.browser()!.newContext({ ...(await page.viewportSize() ? { viewport: page.viewportSize()! } : {}) });
      const gp = await guest.newPage();
      await gp.route(/tile\.openstreetmap\.org/, (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
      const res = await gp.goto(claimUrl);
      expect(res?.status()).toBe(200);
      expect(res!.headers()["content-security-policy"]).toMatch(/script-src 'self' 'nonce-/);
      await expect(gp.getByRole("heading", { level: 1, name: "Chris, pick what you ordered" })).toBeVisible();
      await expect(gp.getByText("Joe sent you a bill from")).toBeVisible();
      await expect(gp.getByRole("navigation", { name: "Legal" })).toBeVisible();
      const list = gp.getByRole("list", { name: "Items on the bill" });
      await expect(list.getByRole("checkbox")).toHaveCount(6);
      // Nothing about the trip leaks: no nav, no other people's contact details, first names only.
      expect(await gp.getByRole("navigation", { name: "Main" }).count()).toBe(0);
      await expectAccessible(gp);
      // Chris keeps just Tsukemen and Gyoza.
      for (const name of ["Yuzu Shio Ramen", "Draft beer", "Cola", "Edamame"]) {
        const box = list.getByRole("checkbox", { name: new RegExp(`^${name}`) });
        if ((await box.getAttribute("aria-checked")) === "true") await box.click();
      }
      await expect(list.getByRole("checkbox", { name: /^Gyoza/ })).toHaveAttribute("aria-checked", "true");
      await expect(gp.getByText(/Your share so far/)).toBeVisible();
      await gp.getByRole("button", { name: "Submit" }).click();
      await expect(gp.getByRole("status").filter({ hasText: "Sent. Joe sees your picks now." })).toHaveCount(1);
      await guest.close();
      await page.goto(`${page.url()}?step=3`);
      await expect(page.getByRole("list", { name: "Shares" }).getByRole("listitem", { name: /^Chris:/ })).toContainText("Claimed");
      await expect(page.getByRole("list", { name: "Shares" }).getByRole("listitem", { name: /^Joe:/ })).toBeVisible();
    }
    // A dead token gets a friendly page, never data.
    await page.goto("/s/00000000000000000000000000000000");
    await expect(page.getByRole("heading", { level: 1, name: "This link isn't active" })).toBeVisible();
    await expectAccessible(page);
  });

  test("the seeded claim link opens for Chris without a session and shows the current picks", async ({ page }) => {
    const res = await page.goto(`/s/${CHRIS_TOKEN}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Chris, pick what you ordered" })).toBeVisible();
    const list = page.getByRole("list", { name: "Items on the bill" });
    await expect(list.getByRole("checkbox", { name: /^Gyoza/ })).toHaveAttribute("aria-checked", "true");
    await expect(list.getByRole("checkbox", { name: /^Tsukemen/ })).toContainText("Just you");
    await expect(list.getByRole("checkbox", { name: /^Coke/ })).toContainText("Nobody yet");
    await expect(page.getByText("Your share so far")).toBeVisible();
    await expect(page.getByText("¥1,824", { exact: false }).first()).toBeVisible();
    await expectAccessible(page);
  });

  test("keyboard: items are real inputs, avatar checkboxes toggle with Space, the stepper is reachable", async ({ authed: page }) => {
    await page.goto(`/split/${AFURI_BILL}?step=2`);
    const coke = page.getByRole("list", { name: "Items to assign" }).getByRole("listitem").filter({ hasText: "Coke" });
    await coke.getByRole("checkbox", { name: "Daniel" }).focus();
    await page.keyboard.press("Space");
    await expect(coke.getByRole("checkbox", { name: "Daniel" })).toHaveAttribute("aria-checked", "true");
    await expect(coke).toContainText("Just Daniel");
    await expect(page.getByText(/^¥6,050 · ¥0 left/)).toBeVisible();
    await page.getByRole("switch", { name: /Everyone shares tax/ }).click();
    await expect(page.getByRole("switch", { name: /Everyone shares tax evenly/ })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "Items" }).click();
    await expect(page.getByText("Step 1 of 3 · Check items")).toBeVisible();
    await page.getByRole("group", { name: "Quantity of Gyoza" }).getByRole("button", { name: "More" }).click();
    await expect(page.getByRole("group", { name: "Quantity of Gyoza" })).toContainText("×2");
    await expect(page.getByRole("region", { name: "Check items" }).getByText("¥7,255", { exact: true })).toBeVisible();
    await expectAccessible(page);
  });

  test("camera → Send to Split starts a draft bill from the priced lines", async ({ authed: page }) => {
    await page.goto("/translate/camera");
    await page.getByRole("button", { name: "Try a sample menu" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Found 6 lines" })).toHaveCount(1);
    await page.getByRole("button", { name: "Send to Split" }).click();
    await expect(page).toHaveURL(/\/split\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("list", { name: "Items" }).getByRole("listitem")).toHaveCount(4);
    await expect(page.getByRole("textbox", { name: "Item name" }).first()).toHaveValue("Yuzu Shio Ramen");
  });
});
