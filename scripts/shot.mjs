/* Still-frame verification for the ?shot hook: loads ?shot=<id>&t=<s> from an already-running
   server (vite preview on :4173), waits for window.__shotReady, saves a PNG, and reports
   console/page errors. Headless chromium has no WebGPU here, so the ?webgl fallback is forced —
   the physical iPhone remains the WebGPU gate.
   Usage: node scripts/shot.mjs <sceneId> <seconds> <outfile.png> */
import { chromium } from "file:///home/z/.npm-global/lib/node_modules/playwright/index.mjs";

const [, , id, t = "30", out = `/tmp/shot-${id}.png`] = process.argv;
if (!id) {
  console.error("usage: node scripts/shot.mjs <sceneId> <seconds> <outfile.png>");
  process.exit(2);
}

const url = `http://localhost:4173/?shot=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}&webgl`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 900, height: 500 }, deviceScaleFactor: 1 });
const errors = [];
page.on("console", (m) => {
  const s = m.text();
  if (/error|failed|NaN|undefined is not|InvalidState/i.test(s)) errors.push(`[console] ${s.slice(0, 240)}`);
});
page.on("pageerror", (e) => errors.push(`[pageerror] ${String(e).slice(0, 240)}`));

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
let ready = false;
try {
  await page.waitForFunction("window.__shotReady === true", { timeout: 120000 });
  ready = true;
} catch {
  errors.push("[fatal] __shotReady never set (timeout)");
}
await page.waitForTimeout(700);
if (ready) await page.screenshot({ path: out });
const backend = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  return c ? (c.getContext("webgl2") ? "webgl2-canvas" : "canvas") : "no-canvas";
}).catch(() => "n/a");

console.log(JSON.stringify({ id, t, out, ready, backend, errors: errors.slice(0, 10) }, null, 1));
await browser.close();
