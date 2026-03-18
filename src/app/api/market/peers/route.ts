import { NextResponse } from 'next/server';
import yahooFinance from '@/lib/yahoo';

const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker')?.toUpperCase();

  if (!ticker) {
    return NextResponse.json({ error: 'ticker parameter is required' }, { status: 400 });
  }

  const cacheKey = `peers_${ticker}`;
  const now = Date.now();
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }
  }

  try {
    const insights = await yahooFinance.insights(ticker) as any;
    // Yahoo's insights usually have a 'recommendation' object with 'recommendedSymbols'
    const recommendedSymbols = insights?.instrumentInfo?.recommendation?.recommendedSymbols || [];
    
    let peers = recommendedSymbols.map((s: any) => s.symbol).filter(Boolean);
    
    // Fallback if no peers found
    if (peers.length === 0) {
       if (['NVDA', 'AMD', 'INTC', 'ARM', 'QCOM', 'TSM'].includes(ticker)) peers = ['NVDA', 'AMD', 'INTC', 'ARM', 'QCOM', 'TSM'].filter(t => t !== ticker);
       else if (['AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN'].includes(ticker)) peers = ['AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN'].filter(t => t !== ticker);
       else peers = ['SPY', 'QQQ']; // Absolute fallback
    }

    cache.set(cacheKey, { data: { ticker, peers: peers.slice(0, 5) }, timestamp: now });
    return NextResponse.json({ ticker, peers: peers.slice(0, 5) });
  } catch (error: any) {
    console.error(`Error fetching peers for ${ticker}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
