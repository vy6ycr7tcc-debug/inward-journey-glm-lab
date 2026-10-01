/* Screenshot the boot/loading UI (no ?shot param — the shot hook hides the loader). */
import { chromium } from "file:///home/z/.npm-global/lib/node_modules/playwright/index.mjs";

const out = process.argv[2] ?? "/tmp/boot.png";
const waitMs = Number(process.argv[3] ?? 1200);
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 900, height: 500 }, deviceScaleFactor: 1 });
await page.goto("http://localhost:4173/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(waitMs);
await page.screenshot({ path: out });
const state = await page.evaluate(() => ({
  loading: !!document.getElementById("loading"),
  bodyClass: document.body.className,
}));
console.log(JSON.stringify({ out, ...state }));
await browser.close();
