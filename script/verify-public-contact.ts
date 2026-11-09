import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

assert.ok(process.env.REPLIT_DEV_DOMAIN, "REPLIT_DEV_DOMAIN is required to verify the running preview.");
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const destination = "mailto:support@cavenwealthfinancial.com";
const errors: string[] = [];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  await mkdir("generated-artifacts", { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/contact`);
    const email = page.getByTestId("link-contact-email");
    await email.waitFor();
    assert.equal(await email.getAttribute("href"), destination);
    assert.equal((await email.innerText()).trim(), destination.slice(7));
    assert.equal(await page.getByTestId("link-footer-email").getAttribute("href"), destination);
    assert.equal(await page.locator('a[href^="tel:"], main form, main input, main textarea').count(), 0);
    assert.doesNotMatch(await page.locator("body").innerText(), /421-9855|Phone Number|Business Hours|New York, USA 10001|Message Sent/);
    assert.ok(await page.locator("main").evaluate(el => el.scrollWidth <= el.clientWidth), `Contact content must fit at ${width}px`);
    const bounds = await email.boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width, `Email must fit at ${width}px`);

    // Verify keyboard activation without attempting to launch an external email application.
    await page.evaluate(() => {
      document.addEventListener("click", event => {
        const link = (event.target as Element).closest('a[href^="mailto:"]');
        if (link) {
          event.preventDefault();
          document.documentElement.dataset.emailDestination = link.getAttribute("href")!;
        }
      }, true);
    });
    await email.focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("html").getAttribute("data-email-destination"), destination);
    if (width !== 320) {
      await page.screenshot({ path: `generated-artifacts/contact-email-only-${width}.png`, fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const route of ["/", "/company", "/operations", "/careers"]) {
    await page.goto(base + route);
    const email = page.getByTestId("link-footer-email");
    await email.waitFor();
    assert.equal(await email.getAttribute("href"), destination);
    assert.doesNotMatch(await page.locator("footer").innerText(), /421-9855|Phone:|New York, USA 10001/);
    assert.equal(await page.locator('a[href^="tel:"]').count(), 0);
  }
  // The customer sign-in page has its own layout, not the shared public footer.
  await page.goto(`${base}/portal`);
  await page.locator('a[href="/contact"]').first().waitFor();
  assert.equal(await page.locator('a[href^="tel:"]').count(), 0);
  assert.deepEqual(errors, []);
  console.log("Public contact verification passed: email-only contact and all public footers, keyboard email activation, no simulated form, and responsive contact content at 1280px, 390px and 320px.");
} finally {
  await browser.close();
}
