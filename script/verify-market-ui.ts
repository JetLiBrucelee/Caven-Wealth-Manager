import assert from "node:assert/strict";
import type { Page } from "playwright-core";
import type { MarketSnapshot } from "../shared/market";

export async function verifyLiveMarketFeed(page: Page) {
  const initial: MarketSnapshot = await (await page.request.get("/api/customer/market")).json();
  const validate = (snapshot: MarketSnapshot) => {
    assert.equal(snapshot.status, "available", `Live provider feed must be available: ${JSON.stringify([...snapshot.equities, ...snapshot.summary].map(({ symbol, state, message }) => ({ symbol, state, message })))}`);
    assert.equal(snapshot.configured, true);
    assert.deepEqual(snapshot.equities.map((quote) => quote.symbol), ["VOO", "BRK.B", "JPM"]);
    assert.deepEqual(snapshot.summary.map((quote) => quote.symbol), ["XAU/USD"]);
    for (const quote of [...snapshot.equities, ...snapshot.summary]) {
      assert.ok(quote.price !== null && quote.price > 0);
      assert.ok(quote.quotedAt && Number.isFinite(Date.parse(quote.quotedAt)));
      assert.ok(["realtime", "delayed", "closed"].includes(quote.state));
    }
  };
  validate(initial);
  assert.equal(await page.getByTestId("market-summary-dow").count(), 0);
  assert.equal(await page.getByTestId("market-summary-nasdaq").count(), 0);
  await page.getByTestId("market-summary-gold-price").waitFor();
  // A real minute must pass: do not fake server time, provider data, or the quote timestamp.
  const update = await page.waitForResponse(async (response) => {
    if (!response.url().endsWith("/api/customer/market") || response.status() !== 200) return false;
    const snapshot: MarketSnapshot = await response.json();
    return !!snapshot.fetchedAt && Date.parse(snapshot.fetchedAt) > Date.parse(initial.fetchedAt!);
  }, { timeout: 80_000 });
  validate(await update.json());
  console.log("Live provider verification passed: authentic prices, gold-only summary, timestamps and automatic minute refresh.");
}

// Controlled network fixtures exist only in this browser test, never in application fallbacks.
export async function verifyMarketUI(page: Page, expectedBalance: string) {
  const real = await page.request.get("/api/customer/market");
  assert.equal(real.status(), 200);
  const actual: MarketSnapshot = await real.json();
  assert.deepEqual(actual.equities.map((quote) => quote.symbol), ["VOO", "BRK.B", "JPM"]);
  assert.ok(!("apiKey" in actual));
  if (!actual.configured) {
    assert.equal(actual.status, "setup_required");
    assert.ok(actual.equities.every((quote) => quote.price === null && quote.quotedAt === null));
  }
  let snapshot: MarketSnapshot = {
    provider: "Twelve Data", configured: true, status: "partial", fetchedAt: new Date().toISOString(), refreshIntervalMs: 60_000,
    equities: actual.equities.map((quote, index) => ({
      ...quote, price: [123.45, 345.67, 67.89][index], percentChange: [1.25, -0.5, 0][index],
      quotedAt: new Date().toISOString(), marketState: "open", state: "realtime", message: null,
    })),
    summary: actual.summary.map((quote) => ({ ...quote, price: 123.45, percentChange: 0.5, quotedAt: new Date().toISOString(), state: "delayed", marketState: "open", delayMinutes: 15, message: null })),
    notice: "Controlled browser-test market response",
  };
  let fail = false;
  await page.route("**/api/customer/market", (route) => route.fulfill({
    status: fail ? 503 : 200, contentType: "application/json",
    body: JSON.stringify(fail ? { message: "Controlled market outage" } : snapshot),
  }));
  const refresh = async () => {
    const response = page.waitForResponse((reply) => reply.url().endsWith("/api/customer/market"));
    await page.getByRole("button", { name: "Refresh market prices", exact: true }).click();
    await response;
  };
  try {
    await refresh();
    const first = page.getByTestId("market-quote-voo");
    await page.waitForFunction(() => document.querySelector('[data-testid="market-quote-voo"]')?.textContent?.includes("$123.45"));
    assert.ok((await first.innerText()).includes("+1.25%"));
    assert.ok((await page.getByTestId("market-quote-brkb").innerText()).includes("-0.5%"));
    assert.ok((await page.getByTestId("market-quote-jpm").innerText()).includes("0%"));
    assert.match(await page.getByTestId("market-summary").innerText(), /Delayed/);
    for (const quote of snapshot.summary) {
      assert.equal(await page.getByTestId(`market-summary-${quote.id}-quoted-at`).getAttribute("datetime"), quote.quotedAt);
    }
    assert.equal(await page.getByTestId("text-dashboard-balance").innerText(), expectedBalance);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

    snapshot = { ...snapshot, equities: snapshot.equities.map((quote) => ({
      ...quote, state: "realtime", marketState: "open", quotedAt: new Date(Date.now() - 3600_000).toISOString(),
    })) };
    await refresh();
    await page.waitForFunction(() => document.querySelector('[data-testid="market-quote-voo"]')?.textContent?.includes("Stale"));
    assert.doesNotMatch(await first.innerText(), /Market open/);
    fail = true;
    await refresh();
    await page.getByText("Market data is temporarily unavailable.", { exact: true }).waitFor();
    assert.equal(await page.getByTestId("text-dashboard-balance").innerText(), expectedBalance);
    assert.ok(!((await page.getByTestId("market-panel").innerText()).includes("$123.45")));
  } finally {
    await page.unroute("**/api/customer/market");
    await refresh();
  }
}
