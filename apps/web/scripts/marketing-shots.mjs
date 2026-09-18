// Captures the landing page's product screenshots from the demo app.
// Usage: node scripts/marketing-shots.mjs http://127.0.0.1:3001 public/marketing
import { mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { chromium, devices } from "@playwright/test";

// ─── Stylised basemap tiles for sandboxed captures (no network) ──────────────
// A soft paper ground with block shapes and streets, seeded per tile so neighbours differ.
// Real OpenStreetMap tiles are used whenever they load; set MARKETING_FAKE_TILES=1 to force these.
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
function tilePng(z, x, y) {
  const N = 256, px = new Uint8Array(N * N * 3);
  let seed = (z * 73856093) ^ (x * 19349663) ^ (y * 83492791);
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const fill = (x0, y0, w, h, [r, g, b]) => { for (let yy = Math.max(0, y0); yy < Math.min(N, y0 + h); yy++) for (let xx = Math.max(0, x0); xx < Math.min(N, x0 + w); xx++) { const i = (yy * N + xx) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b; } };
  fill(0, 0, N, N, [236, 238, 232]);
  for (let i = 0; i < 9; i++) fill(Math.floor(rnd() * N), Math.floor(rnd() * N), 24 + Math.floor(rnd() * 70), 20 + Math.floor(rnd() * 60), rnd() < 0.2 ? [217, 230, 214] : [226, 229, 222]);
  for (let i = 0; i < 3; i++) { fill(0, Math.floor(rnd() * N), N, 3, [255, 255, 255]); fill(Math.floor(rnd() * N), 0, 3, N, [255, 255, 255]); }
  const raw = Buffer.alloc((N * 3 + 1) * N);
  for (let yy = 0; yy < N; yy++) { raw[yy * (N * 3 + 1)] = 0; Buffer.from(px.buffer, yy * N * 3, N * 3).copy(raw, yy * (N * 3 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const tileCache = new Map();
const fakeTile = (url) => { const m = url.match(/\/(\d+)\/(\d+)\/(\d+)\.png/); const k = m ? m.slice(1, 4).join("/") : "0"; if (!tileCache.has(k)) tileCache.set(k, tilePng(...(m ? m.slice(1, 4).map(Number) : [0, 0, 0]))); return tileCache.get(k); };

const [base = "http://127.0.0.1:3001", out = "public/marketing"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SHOTS = [
  { file: "home", path: "/home", device: "phone" },
  { file: "route", path: "/navigate/route?to=44444444-4444-4444-8444-444444444445", device: "phone" },
  { file: "day", path: "/navigate/day?day=2027-03-15&mode=transit", device: "phone" },
  { file: "tree", path: "/navigate/tree?route=55555555-5555-4555-8555-555555555553", device: "desktop" },
  { file: "plan", path: "/plan", device: "phone" },
];
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
for (const scheme of ["light", "dark"]) {
  for (const device of ["phone", "desktop"]) {
    const dev = device === "phone" ? { ...devices["iPhone 15 Pro"], deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 };
    const ctx = await browser.newContext({ ...dev, colorScheme: scheme, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    // Real OpenStreetMap tiles when reachable; otherwise (or with MARKETING_FAKE_TILES=1) the stylised basemap above.
    await page.route(/tile\.openstreetmap\.org/, async (route) => {
      if (!process.env.MARKETING_FAKE_TILES) {
        try { const res = await route.fetch({ timeout: 4000 }); if (res.ok()) return route.fulfill({ response: res }); } catch { /* fall through */ }
      }
      return route.fulfill({ status: 200, contentType: "image/png", body: fakeTile(route.request().url()) });
    });
    await page.goto(`${base}/login?fresh=1`);
    await page.getByLabel("Email").fill("joe@example.com");
    await page.getByLabel("Password").fill("VoyaDemo-2027!");
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(/\/home$/);
    for (const s of SHOTS.filter((x) => x.device === device)) {
      await page.goto(`${base}${s.path}`);
      // Wait for the map (tiles, pins and route lines) rather than a fixed delay.
      await page.locator("[data-map-state]").first().waitFor({ state: "attached" });
      await page.waitForFunction(() => [...document.querySelectorAll("[data-map-state]")].every((el) => el.getAttribute("data-map-state") !== "loading" && el.getAttribute("data-route-state") !== "pending"), null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${out}/${s.file}-${scheme}.jpg`, type: "jpeg", quality: 82 });
      console.log(`${s.file}-${scheme}.jpg`);
    }
    await ctx.close();
  }
}
await browser.close();
