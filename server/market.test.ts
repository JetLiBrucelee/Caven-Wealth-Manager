import assert from "node:assert/strict";
import { test } from "node:test";
import { createMarketService, normalizeQuote, type MarketConfig } from "./market";

const now = Date.parse("2026-11-09T15:00:00Z");
const item = { id: "brkb", symbol: "BRK.B", providerSymbol: "BRK.B", name: "Berkshire Hathaway · Class B", kind: "stock" as const };
const rawQuote = (symbol = "BRK.B", overrides: Record<string, unknown> = {}) => ({
  symbol, currency: "USD", close: "412.56", percent_change: "-0.1",
  last_quote_at: now / 1000, is_market_open: true, ...overrides,
});
const config: MarketConfig = { apiKey: "test-only-not-a-real-key", displayApproved: true, feedMode: "realtime" };
const json = (body: unknown, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });

test("no requests or prices without key, customer-display rights and declared feed mode", async () => {
  for (const settings of [{ ...config, apiKey: undefined }, { ...config, displayApproved: false }, { ...config, feedMode: undefined }]) {
    let calls = 0;
    const service = createMarketService({ config: () => settings, fetcher: (async () => { calls++; throw Error(); }) as typeof fetch });
    const snapshot = await service.snapshot();
    assert.equal(snapshot.status, "setup_required");
    assert.equal(snapshot.fetchedAt, null);
    assert.equal(snapshot.configured, false);
    assert.equal(calls, 0);
    assert.ok([...snapshot.equities, ...snapshot.summary].every((quote) => quote.price === null && quote.quotedAt === null && quote.marketState === "unknown"));
  }
});

test("normalization preserves true quote times, numbers, signs, and instrument identity", () => {
  const quote = normalizeQuote(item, rawQuote(), now, "realtime");
  assert.equal(quote.price, 412.56);
  assert.equal(quote.percentChange, -0.1);
  assert.equal(quote.quotedAt, new Date(now).toISOString());
  assert.equal(quote.state, "realtime");
  for (const changes of [
    { symbol: "BRK.A" }, { currency: "EUR" }, { close: null }, { close: "Infinity" },
    { last_quote_at: null, timestamp: now / 1000 }, { last_quote_at: now / 1000 + 600 },
  ]) assert.equal(normalizeQuote(item, rawQuote("BRK.B", changes), now, "realtime").price, null);
  assert.equal(normalizeQuote(item, rawQuote("BRK.B", { percent_change: null }), now, "realtime").percentChange, null);
  assert.equal(normalizeQuote(item, rawQuote("BRK.B", { percent_change: "0" }), now, "realtime").percentChange, 0);
});

test("delayed, stale, unknown and provider-confirmed holiday closure states are truthful", () => {
  const old = rawQuote("BRK.B", { last_quote_at: now / 1000 - 900 });
  assert.equal(normalizeQuote(item, old, now, "delayed", 15).state, "delayed");
  assert.equal(normalizeQuote(item, old, now, "realtime").state, "stale");
  assert.equal(normalizeQuote(item, old, now, "realtime").marketState, "unknown");
  assert.equal(normalizeQuote(item, rawQuote("BRK.B", { is_market_open: undefined }), now, "realtime").state, "stale");
  const holiday = Date.parse("2026-07-03T16:00:00Z");
  const closed = normalizeQuote(item, rawQuote("BRK.B", { last_quote_at: holiday / 1000 - 86400, is_market_open: false }), holiday, "realtime");
  assert.equal(closed.state, "closed");
  assert.equal(closed.marketState, "closed");
  assert.equal(normalizeQuote(item, rawQuote("BRK.B", { last_quote_at: now / 1000 - 8 * 86400, is_market_open: false }), now, "realtime").state, "stale");
});

test("summary coverage never silently replaces an index with an ETF", () => {
  const index = { ...item, id: "dow", name: "Dow Jones Industrial Average", kind: "index" as const, providerSymbol: "DJI" };
  assert.equal(normalizeQuote(index, rawQuote("DIA", { type: "ETF" }), now, "realtime").price, null);
  assert.equal(normalizeQuote(index, rawQuote("DJI", { type: "Index" }), now, "realtime").price, 412.56);
  const gold = { ...item, id: "gold", name: "Gold spot", kind: "spot" as const, providerSymbol: "XAU/USD" };
  assert.equal(normalizeQuote(gold, rawQuote("XAU/USD", { type: "Precious Metal" }), now, "realtime").price, 412.56);
  assert.equal(normalizeQuote(gold, rawQuote("GC", { type: "Futures" }), now, "realtime").price, null);
});

test("concurrent requests coalesce, cache prices, never send keys in URLs, and preserve timestamps", async () => {
  let clock = now, calls = 0;
  const service = createMarketService({ config: () => config, now: () => clock, fetcher: (async (url, options) => {
    calls++;
    assert.equal(new URL(String(url)).searchParams.has("apikey"), false);
    assert.equal((options?.headers as Record<string, string>).Authorization, `apikey ${config.apiKey}`);
    return json(rawQuote(new URL(String(url)).searchParams.get("symbol")!));
  }) as typeof fetch });
  const snapshots = await Promise.all([service.snapshot(), service.snapshot(), service.snapshot()]);
  assert.equal(calls, 3);
  assert.equal(snapshots[0].configured, true);
  assert.equal(snapshots[0].equities[1].symbol, "BRK.B");
  assert.ok(snapshots[0].summary.every((quote) => quote.price === null));
  clock += 30_000;
  assert.equal((await service.snapshot()).equities[0].quotedAt, snapshots[0].equities[0].quotedAt);
  assert.equal(calls, 3);
  assert.ok(!JSON.stringify(snapshots).includes(config.apiKey!));
});

test("rate limits and authorization failures are sanitized and not immediately retried", async () => {
  for (const status of [401, 429]) {
    let calls = 0, clock = now;
    const service = createMarketService({ config: () => config, now: () => clock, fetcher: (async () => {
      calls++;
      return json({ status: "error", code: status, message: `sensitive-provider-text ${config.apiKey}` }, status, { "retry-after": "300" });
    }) as typeof fetch });
    const snapshot = await service.snapshot();
    assert.equal(calls, 3);
    assert.equal(snapshot.status, "unavailable");
    assert.ok(!JSON.stringify(snapshot).includes(config.apiKey!));
    await service.snapshot();
    assert.equal(calls, 3);
    if (status === 429) {
      clock += 120_000;
      await Promise.all([service.snapshot(), service.snapshot()]);
      assert.equal(calls, 3);
    }
  }
});

test("outages preserve cached quote time but remove live/open claims; transient errors retry once", async () => {
  let failed = false, clock = now, calls = 0;
  const service = createMarketService({ config: () => config, now: () => clock, fetcher: (async (url) => {
    calls++;
    if (failed) return json({ status: "error", code: 503 }, 503);
    return json(rawQuote(new URL(String(url)).searchParams.get("symbol")!));
  }) as typeof fetch });
  const original = await service.snapshot();
  failed = true; clock += 61_000;
  const stale = await service.snapshot();
  assert.equal(calls, 9);
  for (const quote of stale.equities) {
    assert.equal(quote.state, "stale");
    assert.equal(quote.marketState, "unknown");
    assert.equal(quote.quotedAt, original.equities[0].quotedAt);
  }
});

test("revoking display approval removes cached prices", async () => {
  let settings = { ...config };
  const service = createMarketService({ config: () => settings, now: () => now, fetcher: (async (url) => json(rawQuote(new URL(String(url)).searchParams.get("symbol")!))) as typeof fetch });
  await service.snapshot();
  settings = { ...settings, displayApproved: false };
  const disabled = await service.snapshot();
  assert.equal(disabled.configured, false);
  assert.ok(disabled.equities.every((quote) => quote.price === null));
});
