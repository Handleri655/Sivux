import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "kayntikortti.html");
const CARD_W = 1039;
const CARD_H = 661;

const outFront = path.join(__dirname, "sivux-kayntikortti-etu-88x56-300dpi.png");
const outBack = path.join(__dirname, "sivux-kayntikortti-taka-88x56-300dpi.png");

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1400, height: 1800 },
  deviceScaleFactor: 1,
});

await page.goto("file:///" + htmlPath.replace(/\\/g, "/"), {
  waitUntil: "networkidle",
});
await page.waitForTimeout(1500);

async function capture(selector, outPath) {
  const el = page.locator(selector);
  const box = await el.boundingBox();
  if (!box) throw new Error("Missing " + selector);

  // Force exact print size regardless of subpixel layout.
  await page.evaluate(
    ({ sel, w, h }) => {
      const node = document.querySelector(sel);
      node.style.width = w + "px";
      node.style.height = h + "px";
      node.style.minWidth = w + "px";
      node.style.minHeight = h + "px";
      node.style.maxWidth = w + "px";
      node.style.maxHeight = h + "px";
    },
    { sel: selector, w: CARD_W, h: CARD_H }
  );
  await page.waitForTimeout(100);

  const buf = await el.screenshot({
    type: "png",
    omitBackground: false,
  });

  const tmp = outPath + ".tmp.png";
  fs.writeFileSync(tmp, buf);
  fs.copyFileSync(tmp, outPath);
  fs.unlinkSync(tmp);

  const finalBox = await el.boundingBox();
  console.log(
    selector,
    "layout:",
    Math.round(finalBox.width) + "x" + Math.round(finalBox.height),
    "->",
    path.basename(outPath)
  );
}

await capture("#card-front", outFront);
await capture("#card-back", outBack);
await browser.close();
