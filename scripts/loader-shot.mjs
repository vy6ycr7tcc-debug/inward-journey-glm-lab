/* Verify the corner loading widget: render one still frame (?shot — the loop then stops, the
   main thread idles), re-mount the #loading markup over the frame, and screenshot it. */
import { chromium } from "file:///home/z/.npm-global/lib/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";

const out = process.argv[2] ?? "/tmp/loader.png";
const html = readFileSync("index.html", "utf8");
const m = /<div id="loading".*?<\/div>\s*<\/div>\s*<\/div>/.exec(html.replace(/\n/g, " "));
if (!m) {
  console.error("could not extract #loading markup");
  process.exit(2);
}
const markup = m[0];
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 900, height: 500 }, deviceScaleFactor: 1 });
await page.goto("http://localhost:4173/?shot=meadow&t=5&webgl", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction("window.__shotReady === true", null, { timeout: 150000 });
await page.evaluate((mk) => {
  // the shot harness hides the loader and the title for its frame; put the loader back
  const d = document.createElement("div");
  d.innerHTML = mk;
  document.body.appendChild(d.firstElementChild);
}, markup);
await page.waitForTimeout(700);
await page.screenshot({ path: out });
console.log(JSON.stringify({ out }));
await browser.close();
