import { expect, expectAccessible, login, test } from "./fixtures";

test.describe("auth", () => {
  test("welcome → log in → home, with security headers", async ({ page }) => {
    const res = await page.goto("/welcome");
    await expect(page).toHaveURL(/\/welcome$/);
    const h = res!.headers();
    expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-/);
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();

    await expect(page.getByRole("heading", { level: 1, name: "Voya" })).toBeVisible();
    await expect(page.getByText("Your whole trip. One place.")).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/login/);
    await expectAccessible(page);
    await page.getByLabel("Email").fill("joe@example.com");
    await page.getByLabel("Password").fill("wrong-password-1A");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "incorrect" })).toHaveText("Email or password is incorrect.");
    await expect(page.getByLabel("Email")).toHaveValue("joe@example.com"); // kept after the failed attempt

    await page.getByLabel("Password").fill("VoyaDemo-2027!");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/home$/);
    // Session cookie is HttpOnly + SameSite=Lax.
    const cookie = (await page.context().cookies()).find((c) => c.name === "voya_demo_session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
  });

  test("protected routes redirect to welcome and preserve the destination", async ({ page }) => {
    await page.goto("/plan?day=2027-03-15");
    await expect(page).toHaveURL(/\/welcome\?next=%2Fplan/);
    // open redirect attempts are neutralised
    await page.goto("/login?fresh=1&next=//evil.example");
    await page.getByLabel("Email").fill("joe@example.com");
    await page.getByLabel("Password").fill("VoyaDemo-2027!");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/home$/);
  });

  test("welcome back remembers the user; switch account forgets", async ({ page }) => {
    await login(page);
    await page.goto("/profile");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/welcome$/);
    await page.getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/welcome-back$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome back, Joe");
    await expect(page.getByLabel("Email")).toHaveValue("joe@example.com");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Switch account" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("Email")).toHaveValue("");
  });

  test("sign-up validates age, terms and password; marketing is opt-in", async ({ page }) => {
    await page.goto("/signup");
    await expectAccessible(page);
    await expect(page.getByRole("checkbox", { name: /trip tips/ })).not.toBeChecked();
    await page.getByLabel("Your name").fill("Kid");
    await page.getByLabel("Email").fill("kid@example.com");
    await page.getByLabel("Password", { exact: true }).fill("weak");
    await page.getByLabel("Date of birth").fill("2015-01-01");
    await page.getByRole("button", { name: "Create account" }).click();
    const alerts = page.getByRole("alert");
    await expect(alerts.filter({ hasText: "At least 10 characters" })).toBeVisible();
    await expect(alerts.filter({ hasText: "You must be 16 or older" })).toBeVisible();
    await expect(alerts.filter({ hasText: "accept the Terms" })).toBeVisible();
    // password field is described by its hint and flagged invalid
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("aria-invalid", "true");
  });

  test("reset never reveals whether an account exists", async ({ page }) => {
    await page.goto("/reset");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText("If that email has an account");
  });
});
