// Full-page captures of the landing page for review. Usage: node scripts/landing-shots.mjs http://127.0.0.1:3001 /tmp/out
import { chromium, devices } from "@playwright/test";
const [base = "http://127.0.0.1:3001", out = "/tmp"] = process.argv.slice(2);
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
for (const [name, dev] of [["desktop", { viewport: { width: 1280, height: 800 } }], ["iphone", { ...devices["iPhone 15 Pro"], deviceScaleFactor: 1 }]]) {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ ...dev, colorScheme: scheme, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.route(/tile\.openstreetmap\.org/, (r) => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64") }));
    await page.goto(`${base}/`); await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/landing-${name}-${scheme}.png`, fullPage: true });
    await ctx.close();
  }
}
await browser.close(); console.log("done");
