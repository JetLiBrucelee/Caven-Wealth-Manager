import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Clock3, ExternalLink, RefreshCw } from "lucide-react";
import type { MarketQuote, MarketSnapshot } from "@shared/market";

const MARKET_QUERY_KEY = ["/api/customer/market"];

function formatPrice(price: number | null, currency: string): string {
  if (price === null || !Number.isFinite(price)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${currency} ${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

function QuoteTimestamp({ value, testId }: { value: string | null; testId?: string }) {
  if (!value) return <span data-testid={testId}>Quote time unavailable</span>;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return <span data-testid={testId}>Quote time unavailable</span>;
  return (
    <time dateTime={value} data-testid={testId}>
      {new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(date)}
    </time>
  );
}

function ageLabel(value: string | null, now: number): string {
  if (!value) return "Update time unavailable";
  const ageMs = now - new Date(value).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return "Update time unavailable";
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 10) return "Updated just now";
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  return `Updated ${Math.floor(minutes / 60)}h ago`;
}

function quoteStatus(quote: MarketQuote, snapshot: MarketSnapshot, now: number) {
  if (!snapshot.configured || snapshot.status === "setup_required" || quote.state === "unavailable") {
    return { label: "Unavailable", tone: "unavailable" };
  }
  const fetchedAt = snapshot.fetchedAt ? new Date(snapshot.fetchedAt).getTime() : NaN;
  const fetchedAge = now - fetchedAt;
  const quotedAt = quote.quotedAt ? new Date(quote.quotedAt).getTime() : NaN;
  const quoteAge = now - quotedAt;
  if (quote.state === "stale" || !Number.isFinite(fetchedAt) || fetchedAge < 0 || fetchedAge > 90_000 || !Number.isFinite(quotedAt) || quoteAge < 0) {
    return { label: "Stale", tone: "stale" };
  }
  if (quote.state === "closed") {
    return quoteAge <= 7 * 24 * 60 * 60 * 1000
      ? { label: "Closed", tone: "closed" }
      : { label: "Stale", tone: "stale" };
  }
  const delayMinutes = quote.delayMinutes;
  const allowedDelayMinutes = Number.isFinite(delayMinutes) && delayMinutes! >= 0
    ? delayMinutes!
    : 0;
  if (quoteAge > (allowedDelayMinutes + 3) * 60_000) return { label: "Stale", tone: "stale" };
  if (quote.state === "realtime") return { label: "Realtime", tone: "realtime" };
  if (quote.state === "delayed") return { label: "Delayed", tone: "delayed" };
  return { label: "Unavailable", tone: "unavailable" };
}

function marketLabel(quote: MarketQuote, snapshot: MarketSnapshot, now: number) {
  const state = quoteStatus(quote, snapshot, now);
  if (state.tone === "stale" || state.tone === "unavailable" || quote.marketState === "unknown") return "Market status unknown";
  if (quote.marketState === "closed" || state.tone === "closed") return "Market closed";
  return "Market open";
}

function quoteTestId(quote: MarketQuote): string {
  return `market-quote-${quote.symbol.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

function UnavailableQuoteCard({ symbol }: { symbol: string }) {
  const testId = `market-quote-${symbol.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  return (
    <article className="market-quote market-quote-empty" data-testid={testId}>
      <div className="market-quote-heading">
        <p className="market-symbol">{symbol}</p>
        <span className="market-status market-status-unavailable" data-testid={`${testId}-status`}>Unavailable</span>
      </div>
      <p className="market-price" data-testid={`${testId}-price`}>—</p>
      <div className="market-quote-meta">
        <span data-testid={`${testId}-change`}>—</span><span>—</span>
      </div>
      <div className="market-quote-foot">
        <span>Market status unknown</span>
        <QuoteTimestamp value={null} testId={`${testId}-quoted-at`} />
      </div>
    </article>
  );
}

function QuoteCard({ quote, snapshot, now }: { quote: MarketQuote; snapshot: MarketSnapshot; now: number }) {
  const state = quoteStatus(quote, snapshot, now);
  const hasPrice = quote.price !== null && state.tone !== "unavailable" && state.tone !== "stale";
  const changeIsPositive = quote.percentChange !== null && quote.percentChange > 0;
  const changeIsNegative = quote.percentChange !== null && quote.percentChange < 0;
  const testId = quoteTestId(quote);

  return (
    <article className="market-quote" data-testid={testId}>
      <div className="market-quote-heading">
        <div>
          <p className="market-symbol">{quote.symbol}</p>
          <p className="market-name">{quote.name}</p>
        </div>
        <span className={`market-status market-status-${state.tone}`} data-testid={`${testId}-status`}>{state.label}</span>
      </div>
      <p className="market-price" data-testid={`${testId}-price`}>{hasPrice ? formatPrice(quote.price, quote.currency) : "—"}</p>
      <div className="market-quote-meta">
        <span className={`market-change ${changeIsPositive ? "market-change-up" : changeIsNegative ? "market-change-down" : "market-change-neutral"}`} data-testid={`${testId}-change`}>
          {hasPrice ? formatPercent(quote.percentChange) : "—"}
        </span>
        <span>{quote.currency}</span>
      </div>
      <div className="market-quote-foot">
        <span>{marketLabel(quote, snapshot, now)}</span>
        <QuoteTimestamp value={quote.quotedAt} testId={`${testId}-quoted-at`} />
      </div>
    </article>
  );
}

export function CustomerMarketPanel() {
  const [now, setNow] = useState(() => Date.now());
  const marketQuery = useQuery<MarketSnapshot>({
    queryKey: MARKET_QUERY_KEY,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  const snapshot = marketQuery.isError ? undefined : marketQuery.data;
  const isSetup = snapshot?.status === "setup_required" || snapshot?.configured === false;
  const isUnavailable = snapshot?.status === "unavailable" || snapshot?.configured === false;
  const equities = snapshot?.equities ?? [];
  const requestedEquities = ["VOO", "BRK.B", "JPM"].map((symbol) => {
    const normalized = symbol.toLowerCase().replace(/[^a-z0-9]/g, "");
    return {
      symbol,
      quote: equities.find((quote) => quote.symbol.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized),
    };
  });

  return (
    <section className="market-panel" aria-labelledby="market-panel-title" data-testid="market-panel">
      <header className="market-panel-header">
        <div>
          <div className="market-eyebrow"><Activity size={14} aria-hidden="true" /> Market watch</div>
          <h2 id="market-panel-title" className="market-panel-title">Live market prices</h2>
          <p className="market-panel-subtitle">Independent market information — not account holdings.</p>
        </div>
        <div className="market-panel-meta">
          {snapshot && !marketQuery.isError && (
            <>
              <span className="market-refresh-label">
                {snapshot.equities.some((quote) => quoteStatus(quote, snapshot, now).tone === "realtime") && !isSetup
                  ? "Real-time feed · refreshes every minute"
                  : isSetup ? "Feed setup required" : snapshot.status === "unavailable" ? "Feed unavailable" : "Market feed status"}
              </span>
              <span className="market-age"><Clock3 size={13} aria-hidden="true" />{ageLabel(snapshot.fetchedAt, now)}</span>
            </>
          )}
          <button
            type="button"
            className="market-refresh-button"
            onClick={() => void marketQuery.refetch()}
            disabled={marketQuery.isFetching}
            aria-label="Refresh market prices"
          >
            <RefreshCw size={14} className={marketQuery.isFetching ? "market-refreshing" : ""} />
            Refresh
          </button>
        </div>
      </header>

      {marketQuery.isPending ? (
        <div className="market-loading" aria-label="Loading market data">
          <div className="market-skeleton market-skeleton-title" />
          <div className="market-skeleton-grid">{[0, 1, 2].map((item) => <div className="market-skeleton" key={item} />)}</div>
        </div>
      ) : marketQuery.isError ? (
        <div className="market-message market-message-error" role="status">
          <div>
            <strong>Market data is temporarily unavailable.</strong>
            <p>Your balance and ledger activity are unaffected. Try refreshing the market feed.</p>
          </div>
          <button type="button" className="market-retry" onClick={() => void marketQuery.refetch()}>Try again</button>
        </div>
      ) : isSetup ? (
        <div className="market-content">
          <div className="market-message market-message-setup" role="status">
            <div>
              <strong>Quotes are not available yet.</strong>
              <p>Licensed market-data access is being configured. No prices are displayed until a feed is approved.</p>
            </div>
            <span className="market-status market-status-unavailable">Unavailable</span>
          </div>
          <div className="market-quote-grid">
            {requestedEquities.map(({ symbol, quote }) => quote
              ? <QuoteCard key={quote.id} quote={quote} snapshot={snapshot!} now={now} />
              : <UnavailableQuoteCard key={symbol} symbol={symbol} />)}
          </div>
        </div>
      ) : (
        <div className="market-content">
          {isUnavailable && (
            <div className="market-message market-message-setup" role="status">
              <div><strong>Market feed is unavailable.</strong><p>Prices will appear when an approved data feed is available.</p></div>
              <span className="market-status market-status-unavailable">Unavailable</span>
            </div>
          )}
          <div className="market-quote-grid">
            {requestedEquities.map(({ symbol, quote }) => quote
              ? <QuoteCard key={quote.id} quote={quote} snapshot={snapshot!} now={now} />
              : <UnavailableQuoteCard key={symbol} symbol={symbol} />)}
          </div>
        </div>
      )}

      <footer className="market-panel-footer">
        <span>{snapshot?.status === "setup_required" ? "Quotes will appear after licensed provider credentials are approved." : snapshot?.notice || "Market quotes are provided for general information only."}</span>
        <a href="https://twelvedata.com" target="_blank" rel="noreferrer">
          Provider attribution · Twelve Data <ExternalLink size={12} aria-hidden="true" />
        </a>
      </footer>
    </section>
  );
}

const SUMMARY_INSTRUMENTS = [
  { id: "dow", label: "Dow" },
  { id: "nasdaq", label: "Nasdaq" },
  { id: "gold", label: "Gold" },
] as const;

export function CustomerMarketSummary() {
  const [now, setNow] = useState(() => Date.now());
  const marketQuery = useQuery<MarketSnapshot>({
    queryKey: MARKET_QUERY_KEY,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  const snapshot = marketQuery.isError ? undefined : marketQuery.data;
  const isSetup = snapshot?.status === "setup_required" || snapshot?.configured === false;
  const isUnavailable = snapshot?.status === "unavailable" || snapshot?.configured === false;

  return (
    <section className="market-summary-card" aria-labelledby="market-summary-title" data-testid="market-summary">
      <header className="market-summary-card-heading">
        <div>
          <p className="market-eyebrow">Market indicators</p>
          <h2 id="market-summary-title">Market summary</h2>
        </div>
        <span className={`market-status ${isSetup || isUnavailable || marketQuery.isError ? "market-status-unavailable" : "market-status-neutral"}`}>
          {marketQuery.isPending ? "Loading" : marketQuery.isError || isUnavailable ? "Unavailable" : isSetup ? "Awaiting coverage" : "Coverage"}
        </span>
      </header>

      {marketQuery.isPending ? (
        <div className="market-summary-loading" aria-label="Loading market summary">
          {[0, 1, 2].map((item) => <div className="market-summary-skeleton" key={item} />)}
        </div>
      ) : marketQuery.isError ? (
        <p className="market-summary-error" role="status">Market summary unavailable. Account balances are unaffected.</p>
      ) : (
        <div className="market-summary-rows">
          {SUMMARY_INSTRUMENTS.filter(({ id }) => !snapshot || snapshot.summary.some((quote) => quote.id === id)).map(({ id, label }) => {
            const quote = snapshot?.summary.find((item) => item.id === id);
            const status = quote && snapshot
              ? quoteStatus(quote, snapshot, now)
              : { label: "Unavailable", tone: "unavailable" };
            const hasPrice = Boolean(quote && quote.price !== null && status.tone !== "unavailable" && status.tone !== "stale");
            const change = quote?.percentChange ?? null;
            const testId = `market-summary-${id}`;
            const isPositive = change !== null && change > 0;
            const isNegative = change !== null && change < 0;

            return (
              <article className="market-summary-row" key={id} data-testid={testId}>
                <div className="market-summary-instrument">
                  <div className="market-summary-name">
                    <h3>{quote?.name ?? label}</h3>
                    <p>{quote ? `${quote.symbol} · ${quote.currency}` : `${label} · —`}</p>
                  </div>
                  <span className={`market-status market-status-${status.tone}`} data-testid={`${testId}-status`}>{status.label}</span>
                </div>
                <div className="market-summary-values">
                  <strong data-testid={`${testId}-price`}>{hasPrice && quote ? formatPrice(quote.price, quote.currency) : "—"}</strong>
                  <span className={`market-change ${isPositive ? "market-change-up" : isNegative ? "market-change-down" : "market-change-neutral"}`} data-testid={`${testId}-change`}>
                    {hasPrice ? formatPercent(change) : "—"}
                  </span>
                </div>
                <div className="market-summary-detail">
                  <span className="market-summary-kind" data-testid={`${testId}-kind`}>{quote?.kind ?? "Kind unavailable"}</span>
                  <span data-testid={`${testId}-market-state`}>{quote && snapshot ? marketLabel(quote, snapshot, now) : "Market status unknown"}</span>
                  <span className="market-summary-time">{quote ? <QuoteTimestamp value={quote.quotedAt} testId={`${testId}-quoted-at`} /> : <span data-testid={`${testId}-quoted-at`}>Quote time unavailable</span>}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <footer className="market-summary-footer">
        {isSetup ? "No quotes until licensed market-data access is approved." : isUnavailable ? "Market prices are temporarily unavailable." : "Market information only; not account holdings."}
      </footer>
    </section>
  );
}
