import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";

// Keep the publicly served PNG alternative aligned with the SVG wordmark.
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 350 }, deviceScaleFactor: 1 });
  const svg = await readFile("client/public/logo-finance.svg", "utf8");
  await page.setContent(`<style>html,body{margin:0;background:white}svg{display:block;width:1024px;height:350px}</style>${svg}`);
  await page.locator("svg image").evaluate(async (image: SVGImageElement) => {
    const preload = new Image();
    preload.src = image.href.baseVal;
    await preload.decode();
  });
  await page.locator("svg").screenshot({ path: "client/public/logo.png" });
  console.log("Updated public PNG wordmark from the current Alderbridge SVG.");
} finally { await browser.close(); }
