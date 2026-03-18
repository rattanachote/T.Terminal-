import { NextResponse } from 'next/server';
import yahooFinance from '@/lib/yahoo';

const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours (ownership changes slowly)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker')?.toUpperCase();

  if (!ticker) {
    return NextResponse.json({ error: 'ticker parameter is required' }, { status: 400 });
  }

  const cacheKey = `ownership_${ticker}`;
  const now = Date.now();
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }
  }

  try {
    const quoteSummary = await yahooFinance.quoteSummary(ticker, { 
      modules: ['majorHoldersBreakdown', 'fundOwnership', 'insiderTransactions'] 
    }) as any;

    const data = {
      majorHolders: quoteSummary.majorHoldersBreakdown,
      funds: quoteSummary.fundOwnership?.ownershipList || [],
      insiders: quoteSummary.insiderTransactions?.transactions || []
    };

    cache.set(cacheKey, { data, timestamp: now });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`Error fetching ownership for ${ticker}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
