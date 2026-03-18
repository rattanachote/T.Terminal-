import { NextResponse } from 'next/server';
import yahooFinance from '@/lib/yahoo';

// Simple in-memory cache to prevent rate-limiting when switching tabs
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 Hour

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker')?.toUpperCase();

  if (!ticker) {
    return NextResponse.json({ error: 'ticker parameter is required' }, { status: 400 });
  }

  const cacheKey = `profile_${ticker}`;
  const now = Date.now();
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }
  }

  try {
    const quoteSummary = await yahooFinance.quoteSummary(ticker, { 
      modules: ['assetProfile', 'defaultKeyStatistics', 'financialData'] 
    }) as any;

    const data = {
      profile: quoteSummary.assetProfile,
      stats: quoteSummary.defaultKeyStatistics,
      financials: quoteSummary.financialData
    };

    cache.set(cacheKey, { data, timestamp: now });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`Error fetching profile for ${ticker}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
