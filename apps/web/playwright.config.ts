import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against a production build (`next build && next start`) in demo mode
 * (no Supabase, deterministic data) — the same bundle users get. Set PW_DEV=1 to
 * target `next dev` instead. Projects cover the device classes from the design
 * handoff: iPhone, Android, iPad and desktop, each in light and dark.
 */
const PORT = Number(process.env.PORT ?? 3001);
const baseURL = `http://127.0.0.1:${PORT}`;
const useDev = process.env.PW_DEV === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL,
    // Sandboxed CI images ship a pinned Chromium; PW_CHROMIUM_PATH points at it instead of downloading.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // OSM tiles are blocked in tests (offline-safe, no rate-limit hits); the map shows its fallback tint.
    serviceWorkers: "block",
  },
  webServer: {
    command: useDev ? `pnpm dev -- -p ${PORT}` : `pnpm build && pnpm exec next start -p ${PORT}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: { VOYA_DEMO: "1", NEXT_PUBLIC_SITE_URL: baseURL, PLAYWRIGHT: "1", VOYA_RATE_LIMIT_CAPACITY: "1000" },
  },
  // Apple device presets default to WebKit; we run them in Chromium (same viewport/UA/touch) so one
  // browser binary covers CI. Add real WebKit projects when Safari-specific bugs need chasing.
  projects: [
    { name: "iphone-light", use: { ...devices["iPhone 15 Pro"], browserName: "chromium", colorScheme: "light" } },
    { name: "iphone-dark", use: { ...devices["iPhone 15 Pro"], browserName: "chromium", colorScheme: "dark" } },
    { name: "android-light", use: { ...devices["Pixel 7"], colorScheme: "light" } },
    { name: "ipad-light", use: { ...devices["iPad Pro 11 landscape"], browserName: "chromium", colorScheme: "light" } },
    { name: "desktop-light", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, colorScheme: "light" } },
    { name: "desktop-dark", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, colorScheme: "dark" } },
  ],
});
