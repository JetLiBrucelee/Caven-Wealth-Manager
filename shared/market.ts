export type MarketState = "open" | "closed" | "unknown";
export type QuoteState = "realtime" | "delayed" | "stale" | "closed" | "unavailable";
export interface MarketQuote {
  id: string;
  symbol: string;
  name: string;
  kind: "etf" | "stock" | "index" | "spot";
  currency: string;
  price: number | null;
  percentChange: number | null;
  quotedAt: string | null;
  marketState: MarketState;
  state: QuoteState;
  message: string | null;
  delayMinutes?: number;
}
export interface MarketSnapshot {
  provider: "Twelve Data";
  configured: boolean;
  status: "setup_required" | "available" | "partial" | "unavailable";
  fetchedAt: string | null;
  refreshIntervalMs: number;
  equities: MarketQuote[];
  summary: MarketQuote[];
  notice: string;
}
