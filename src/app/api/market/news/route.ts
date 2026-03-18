import { NextResponse } from 'next/server';
import yahooFinance from '@/lib/yahoo';

const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 mins for news

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker')?.toUpperCase();

  if (!ticker) {
    return NextResponse.json({ error: 'ticker parameter is required' }, { status: 400 });
  }

  const cacheKey = `news_${ticker}`;
  const now = Date.now();
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }
  }

  try {
    const newsRes = await yahooFinance.search(ticker, { newsCount: 15 }) as any;

    cache.set(cacheKey, { data: newsRes.news, timestamp: now });
    return NextResponse.json(newsRes.news);
  } catch (error: any) {
    console.error(`Error fetching news for ${ticker}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
