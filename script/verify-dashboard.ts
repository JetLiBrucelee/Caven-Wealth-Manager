import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import { INSTITUTION } from "../shared/institution";
import { verifyLiveMarketFeed, verifyMarketUI } from "./verify-market-ui";

export async function verifyDashboard(input: {
  base: string; username: string; password: string; code: string;
  balance: string; credits: string; label: string; mobile?: boolean;
  historyEntries?: { id: number; description: string; reference: string; institutionReference: string | null }[];
}) {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium",
    headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    baseURL: input.base,
    viewport: input.mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
  });
  try {
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/portal");
    await page.getByTestId("input-username").fill(input.username);
    await page.getByTestId("input-password").fill(input.password);
    await page.getByTestId("button-login-submit").click();
    await page.getByTestId("input-access-code").fill(input.code);
    await page.getByTestId("button-verify-code").click();
    await page.waitForFunction((expected) => document.querySelector('[data-testid="text-dashboard-balance"]')?.textContent === expected, input.balance);
    await page.waitForFunction((expected) => document.querySelector('[data-testid="text-ledger-posted-credits"]')?.textContent === expected, input.credits);
    assert.equal(await page.getByTestId("text-ledger-posted-debits").textContent(), "$0.00");
    assert.equal(await page.getByTestId("text-ledger-pending-count").textContent(), "0");
    assert.doesNotMatch(await page.locator("body").innerText(), /YTD|Dividend Yield|Risk Score|Portfolio Allocation|Today's advisor note/);
    assert.doesNotMatch(await page.locator("body").innerText(), /Internal ledger: balances and activity are internal application records/);
    await page.reload();
    await page.waitForFunction((expected) => document.querySelector('[data-testid="text-dashboard-balance"]')?.textContent === expected, input.balance);
    if (input.mobile) {
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "The mobile dashboard must not overflow horizontally");
      await page.getByTestId("button-customer-mobile-menu").click();
      await page.getByTestId("link-customer-history").click();
      await page.getByTestId("button-customer-mobile-menu").click();
      await page.getByTestId("link-customer-dashboard").click();
      await page.getByTestId("text-dashboard-balance").waitFor({ state: "visible" });
      assert.ok((await page.getByTestId("text-dashboard-balance").boundingBox())!.width > 250, "The account view must have usable mobile width");
    }
    assert.deepEqual(errors, []);
    await mkdir("generated-artifacts", { recursive: true });
    await page.screenshot({ path: `generated-artifacts/ledger-dashboard-${input.label}.png`, fullPage: true });
    if (input.label === "opening" || input.label === "zero") {
      if (input.label === "opening" && process.env.VERIFY_LIVE_MARKET === "true") {
        await verifyLiveMarketFeed(page);
      }
      await verifyMarketUI(page, input.balance);
    }
    if (input.historyEntries?.length) {
      for (const entry of input.historyEntries) {
        const recent = page.getByTestId(`dashboard-tx-${entry.id}`);
        assert.ok((await recent.innerText()).includes(entry.description));
        assert.ok((await recent.innerText()).includes(entry.reference));
      }
      if (input.mobile) await page.getByTestId("button-customer-mobile-menu").click();
      await page.getByTestId("link-customer-history").click();
      await page.getByTestId("text-history-title").waitFor({ state: "visible" });
      assert.equal(await page.getByText("Internal ledger activity. Future-dated entries remain Pending until their scheduled date.", { exact: true }).count(), 0);
      for (const entry of input.historyEntries) {
        const row = page.getByTestId(`row-transaction-${entry.id}`);
        await row.waitFor();
        assert.ok((await row.innerText()).includes(entry.description));
        assert.ok((await row.innerText()).includes(entry.reference));
        assert.match(await row.innerText(), /Internal/);
        await row.click();
        if (entry.institutionReference) {
          assert.ok((await row.innerText()).includes(INSTITUTION.name));
          assert.ok((await row.innerText()).includes(`Institution account reference: ${entry.institutionReference}`));
        } else assert.equal(await row.locator('[data-testid^="institution-reference-"]').count(), 0);
        await row.click();
      }
      await page.getByTestId(`row-transaction-${input.historyEntries[0].id}`).click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "History must not overflow horizontally");
      await page.screenshot({ path: `generated-artifacts/ledger-history-${input.label}.png`, fullPage: true });
    }
  } finally {
    await context.request.post("/api/customer/logout").catch(() => {});
    await context.close();
    await browser.close();
  }
}
