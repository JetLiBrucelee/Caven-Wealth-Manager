import type { MarketQuote, MarketSnapshot } from "@shared/market";

type FeedMode = "realtime" | "delayed";
export interface MarketConfig {
  apiKey?: string;
  displayApproved: boolean;
  feedMode?: FeedMode;
  delayMinutes?: number;
  summaryApproved?: boolean;
  summarySymbols?: { dow?: string; nasdaq?: string; gold?: string };
  summaryFeedMode?: FeedMode;
  summaryDelayMinutes?: number;
}
interface Instrument {
  id: string; symbol: string; name: string; kind: MarketQuote["kind"]; providerSymbol?: string;
}
const equities: Instrument[] = [
  { id: "voo", symbol: "VOO", providerSymbol: "VOO", name: "Vanguard S&P 500 ETF", kind: "etf" },
  { id: "brkb", symbol: "BRK.B", providerSymbol: "BRK.B", name: "Berkshire Hathaway · Class B", kind: "stock" },
  { id: "jpm", symbol: "JPM", providerSymbol: "JPM", name: "JPMorgan Chase", kind: "stock" },
];
const summary: Instrument[] = [
  { id: "dow", symbol: "DJI", name: "Dow Jones Industrial Average", kind: "index" },
  { id: "nasdaq", symbol: "IXIC", name: "Nasdaq Composite", kind: "index" },
  { id: "gold", symbol: "XAU/USD", name: "Gold spot · USD / troy oz", kind: "spot" },
];
export const MARKET_REFRESH_MS = 60_000;
const unavailable = (item: Instrument, message: string): MarketQuote => ({
  id: item.id, symbol: item.symbol, name: item.name, kind: item.kind, currency: "USD",
  price: null, percentChange: null, quotedAt: null, marketState: "unknown", state: "unavailable", message,
});
const finiteNumber = (value: unknown): number | null => {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const validMode = (mode: string | undefined): mode is FeedMode => mode === "realtime" || mode === "delayed";
const validDelay = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value >= 0 && value <= 1440;
class ProviderRequestError extends Error {
  constructor(public retryable: boolean) { super("Market provider request failed"); }
}
function feedReady(mode?: FeedMode, delay?: number) {
  return validMode(mode) && (mode !== "delayed" || validDelay(delay));
}

export function readMarketConfig(): MarketConfig {
  const env = process.env;
  return {
    apiKey: env.TWELVE_DATA_API_KEY,
    displayApproved: env.TWELVE_DATA_DISPLAY_APPROVED === "true",
    feedMode: validMode(env.TWELVE_DATA_FEED_MODE) ? env.TWELVE_DATA_FEED_MODE : undefined,
    delayMinutes: env.TWELVE_DATA_DELAY_MINUTES ? Number(env.TWELVE_DATA_DELAY_MINUTES) : undefined,
    summaryApproved: env.TWELVE_DATA_SUMMARY_DISPLAY_APPROVED === "true",
    summaryFeedMode: validMode(env.TWELVE_DATA_SUMMARY_FEED_MODE) ? env.TWELVE_DATA_SUMMARY_FEED_MODE : undefined,
    summaryDelayMinutes: env.TWELVE_DATA_SUMMARY_DELAY_MINUTES ? Number(env.TWELVE_DATA_SUMMARY_DELAY_MINUTES) : undefined,
    summarySymbols: { dow: env.TWELVE_DATA_DOW_SYMBOL, nasdaq: env.TWELVE_DATA_NASDAQ_SYMBOL, gold: env.TWELVE_DATA_GOLD_SYMBOL },
  };
}

export function normalizeQuote(item: Instrument, raw: any, now: number, mode: FeedMode, delayMinutes = 0): MarketQuote {
  const price = finiteNumber(raw?.close);
  // timestamp/datetime are the opening time of the requested bar, not a last quote.
  const timestamp = finiteNumber(raw?.last_quote_at);
  if (raw?.status === "error" || raw?.symbol !== item.providerSymbol || raw?.currency !== "USD"
    || price === null || price <= 0 || timestamp === null || !Number.isInteger(timestamp)
    || timestamp < 946684800 || timestamp * 1000 > now + 60_000) {
    return unavailable(item, "Quote temporarily unavailable");
  }
  // Explicit symbol configuration plus provider type verification prevents ETF/index substitutions.
  if ((item.kind === "index" && !/index/i.test(raw?.type || ""))
    || (item.kind === "spot" && (raw?.symbol !== "XAU/USD" || !/forex|physical\s*currency|commodity|precious\s*metal/i.test(raw?.type || raw?.instrument_type || "")))) {
    return unavailable(item, "Instrument coverage needs verification");
  }
  const age = now - timestamp * 1000;
  const marketState = raw.is_market_open === true ? "open" : raw.is_market_open === false ? "closed" : "unknown";
  const stale = age > (marketState === "closed" ? 7 * 86400_000 : delayMinutes * 60_000 + 180_000);
  return {
    ...unavailable(item, ""), price, percentChange: finiteNumber(raw.percent_change),
    quotedAt: new Date(timestamp * 1000).toISOString(), marketState: stale ? "unknown" : marketState,
    state: stale ? "stale" : marketState === "closed" ? "closed" : mode === "delayed" ? "delayed" : marketState === "open" ? "realtime" : "stale",
    message: stale ? "Last quote is older than expected" : null, delayMinutes: mode === "delayed" ? delayMinutes : 0,
  };
}

export function createMarketService(options: {
  config?: () => MarketConfig; fetcher?: typeof fetch; now?: () => number; timeoutMs?: number;
} = {}) {
  const config = options.config || readMarketConfig;
  const fetcher = options.fetcher || fetch;
  const now = options.now || Date.now;
  let cached: MarketSnapshot | null = null;
  let cachedAt = 0;
  let cooldownUntil = 0;
  let inFlight: Promise<MarketSnapshot> | null = null;
  let lastConfigSignature = "";
  const staleSnapshot = (snapshot: MarketSnapshot): MarketSnapshot => ({
    ...snapshot, status: "unavailable",
    equities: snapshot.equities.map(staleQuote), summary: snapshot.summary.map(staleQuote),
  });
  function staleQuote(quote: MarketQuote): MarketQuote {
    return quote.price === null ? quote : { ...quote, state: "stale", marketState: "unknown", message: "Connection interrupted · last recorded quote" };
  }
  async function load(settings: MarketConfig): Promise<MarketSnapshot> {
    let hadFailure = false;
    async function quote(item: Instrument, mode: FeedMode, delay = 0): Promise<MarketQuote> {
      if (!item.providerSymbol || !/^[A-Z0-9.^/_-]{1,30}$/.test(item.providerSymbol)) {
        return unavailable(item, "Coverage not enabled");
      }
      const url = new URL("https://api.twelvedata.com/quote");
      url.searchParams.set("symbol", item.providerSymbol);
      url.searchParams.set("interval", "1day");
      url.searchParams.set("prepost", "false");
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetcher(url, {
            headers: { Authorization: `apikey ${settings.apiKey}` },
            signal: AbortSignal.timeout(options.timeoutMs ?? 8000),
          });
          const raw = await response.json();
          if (response.status === 429 || raw?.code === 429) {
            const retrySeconds = Number(response.headers.get("retry-after"));
            cooldownUntil = Math.max(cooldownUntil, now() + Math.min(900_000, Math.max(60_000, (Number.isFinite(retrySeconds) ? retrySeconds : 60) * 1000)));
            throw new ProviderRequestError(false);
          }
          if (response.status >= 500 || raw?.code >= 500) throw new ProviderRequestError(true);
          if (!response.ok || raw?.status === "error") throw new ProviderRequestError(false);
          const normalized = normalizeQuote(item, raw, now(), mode, delay);
          if (normalized.price === null) throw new ProviderRequestError(false);
          return normalized;
        } catch (error) {
          // Do not log provider errors: their text may echo authorization details.
          if (attempt === 0 && now() >= cooldownUntil && (!(error instanceof ProviderRequestError) || error.retryable)) {
            await new Promise((resolve) => setTimeout(resolve, 250));
            continue;
          }
          hadFailure = true;
          const previous = [...(cached?.equities || []), ...(cached?.summary || [])].find((entry) => entry.id === item.id);
          return previous && previous.price !== null ? staleQuote(previous) : unavailable(item, now() < cooldownUntil ? "Provider limit reached · retrying later" : "Quote temporarily unavailable");
        }
      }
      return unavailable(item, "Quote temporarily unavailable");
    }
    const [stockQuotes, summaryQuotes] = await Promise.all([
      Promise.all(equities.map((item) => quote(item, settings.feedMode!, settings.delayMinutes))),
      Promise.all(summary.map((item) => {
        const providerSymbol = settings.summarySymbols?.[item.id as "dow" | "nasdaq" | "gold"];
        return settings.summaryApproved && feedReady(settings.summaryFeedMode, settings.summaryDelayMinutes) && providerSymbol
          ? quote({ ...item, providerSymbol }, settings.summaryFeedMode!, settings.summaryDelayMinutes)
          : Promise.resolve(unavailable(item, "Coverage not enabled"));
      })),
    ]);
    const available = [...stockQuotes, ...summaryQuotes].filter((item) => item.price !== null && item.state !== "stale").length;
    return {
      provider: "Twelve Data", configured: true,
      status: available === 6 && !hadFailure ? "available" : available ? "partial" : "unavailable",
      fetchedAt: new Date(now()).toISOString(), refreshIntervalMs: MARKET_REFRESH_MS,
      equities: stockQuotes, summary: summaryQuotes,
      notice: "Informational market quotes, not account holdings. US equity feed uses selected venues, not consolidated exchange coverage.",
    };
  }
  return {
    async snapshot(): Promise<MarketSnapshot> {
      const settings = config();
      const signature = JSON.stringify(settings); // memory only; never log credentials or this signature
      if (signature !== lastConfigSignature) {
        cached = null; cachedAt = 0; cooldownUntil = 0; lastConfigSignature = signature;
      }
      if (!settings.apiKey || !settings.displayApproved || !feedReady(settings.feedMode, settings.delayMinutes)) {
        return {
          provider: "Twelve Data", configured: false, status: "setup_required", fetchedAt: null, refreshIntervalMs: MARKET_REFRESH_MS,
          equities: equities.map((item) => unavailable(item, "Market data not connected")),
          summary: summary.map((item) => unavailable(item, "Coverage not enabled")),
          notice: "Market data is not connected. Customer-display licensing and provider setup are required.",
        };
      }
      if (cached && now() - cachedAt < MARKET_REFRESH_MS) return cached;
      if (inFlight) return inFlight;
      if (now() < cooldownUntil && cached) return staleSnapshot(cached);
      inFlight = load(settings).then((snapshot) => { cached = snapshot; cachedAt = now(); return snapshot; }).finally(() => { inFlight = null; });
      return inFlight;
    },
  };
}

export const marketService = createMarketService();
