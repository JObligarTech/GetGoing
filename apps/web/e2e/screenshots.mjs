// Visual review helper: captures the core screens per device + theme into scratch.
// Usage: node e2e/screenshots.mjs http://127.0.0.1:3000 /tmp/out
import { chromium, devices } from "@playwright/test";

const [base = "http://127.0.0.1:3000", out = "./screens"] = process.argv.slice(2);
const targets = [
  { name: "iphone", ...devices["iPhone 15 Pro"] },
  { name: "desktop", viewport: { width: 1280, height: 800 } },
];
const screens = [
  { path: "/welcome", file: "welcome", auth: false },
  { path: "/home", file: "home" },
  { path: "/trips", file: "trips" },
  { path: "/plan", file: "plan" },
  { path: "/plan?view=map", file: "plan-map" },
  { path: "/plan/place/44444444-4444-4444-8444-444444444441", file: "stay" },
];
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
for (const t of targets) {
  for (const scheme of ["light", "dark"]) {
    const { name, ...dev } = t;
    const ctx = await browser.newContext({ ...dev, colorScheme: scheme });
    const page = await ctx.newPage();
    await page.goto(`${base}/login?fresh=1`);
    await page.getByLabel("Email").fill("joe@example.com");
    await page.getByLabel("Password").fill("VoyaDemo-2027!");
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(/\/home$/);
    for (const s of screens) {
      if (s.auth === false) {
        const c2 = await browser.newContext({ ...dev, colorScheme: scheme });
        const p2 = await c2.newPage();
        await p2.goto(`${base}${s.path}`);
        await p2.waitForTimeout(1500);
        await p2.screenshot({ path: `${out}/${name}-${scheme}-${s.file}.png` });
        await c2.close();
        continue;
      }
      await page.goto(`${base}${s.path}`);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${out}/${name}-${scheme}-${s.file}.png` });
    }
    await ctx.close();
  }
}
await browser.close();
console.log("done");
