import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "kayntikortti.html");
const outFront = path.join(__dirname, "sivux-kayntikortti-etu-88x56-300dpi.png");
const outBack = path.join(__dirname, "sivux-kayntikortti-taka-88x56-300dpi.png");

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 1600 },
  deviceScaleFactor: 1,
});

await page.goto("file://" + htmlPath.replace(/\\/g, "/"), {
  waitUntil: "networkidle",
});
await page.waitForTimeout(1500);

const front = page.locator("#card-front");
const back = page.locator("#card-back");

await front.screenshot({ path: outFront, type: "png" });
await back.screenshot({ path: outBack, type: "png" });

const box = await front.boundingBox();
console.log("Front px:", Math.round(box.width), "x", Math.round(box.height));
console.log("Saved:", outFront);
console.log("Saved:", outBack);

await browser.close();
