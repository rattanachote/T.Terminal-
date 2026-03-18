import { NextResponse } from 'next/server';
import yahooFinance from '@/lib/yahoo';

const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute for screener data

const INDEX_TICKERS = ['^GSPC', '^IXIC', '^DJI', '^RUT', '^VIX'];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || 'all'; // all, gainers, losers, active, indices

  const cacheKey = `screener_${category}`;
  const now = Date.now();
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }
  }

  try {
    const result: any = {};

    if (category === 'indices' || category === 'all') {
      try {
        const indexQuotes = await yahooFinance.quote(INDEX_TICKERS);
        const arr = Array.isArray(indexQuotes) ? indexQuotes : [indexQuotes];
        result.indices = arr.map((q: any) => ({
          ticker: q.symbol,
          name: q.shortName || q.longName || q.symbol,
          lastPx: q.regularMarketPrice,
          change: q.regularMarketChange,
          changePct: q.regularMarketChangePercent,
          volume: q.regularMarketVolume,
        }));
      } catch (e) {
        console.error('Failed to fetch indices', e);
        result.indices = [];
      }
    }

    if (category === 'gainers' || category === 'all') {
      try {
        const gainers = await yahooFinance.screener({ scrIds: 'day_gainers', count: 15 }) as any;
        result.gainers = (gainers?.quotes || []).map((q: any) => ({
          ticker: q.symbol,
          name: q.shortName || q.longName || q.symbol,
          lastPx: q.regularMarketPrice,
          change: q.regularMarketChange,
          changePct: q.regularMarketChangePercent,
          mktCap: q.marketCap,
          volume: q.regularMarketVolume,
        }));
      } catch (e) {
        console.error('Failed to fetch gainers', e);
        result.gainers = [];
      }
    }

    if (category === 'losers' || category === 'all') {
      try {
        const losers = await yahooFinance.screener({ scrIds: 'day_losers', count: 15 }) as any;
        result.losers = (losers?.quotes || []).map((q: any) => ({
          ticker: q.symbol,
          name: q.shortName || q.longName || q.symbol,
          lastPx: q.regularMarketPrice,
          change: q.regularMarketChange,
          changePct: q.regularMarketChangePercent,
          mktCap: q.marketCap,
          volume: q.regularMarketVolume,
        }));
      } catch (e) {
        console.error('Failed to fetch losers', e);
        result.losers = [];
      }
    }

    if (category === 'active' || category === 'all') {
      try {
        // Most active: use trendingSymbols or screener
        const trending = await yahooFinance.trendingSymbols('US') as any;
        const symbols = (trending?.quotes || []).slice(0, 15).map((q: any) => q.symbol).filter(Boolean);
        if (symbols.length > 0) {
          const activeQuotes = await yahooFinance.quote(symbols);
          const arr = Array.isArray(activeQuotes) ? activeQuotes : [activeQuotes];
          result.active = arr.map((q: any) => ({
            ticker: q.symbol,
            name: q.shortName || q.longName || q.symbol,
            lastPx: q.regularMarketPrice,
            change: q.regularMarketChange,
            changePct: q.regularMarketChangePercent,
            mktCap: q.marketCap,
            volume: q.regularMarketVolume,
          }));
        } else {
          result.active = [];
        }
      } catch (e) {
        console.error('Failed to fetch trending', e);
        result.active = [];
      }
    }

    cache.set(cacheKey, { data: result, timestamp: now });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Screener error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
