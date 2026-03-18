import { NextResponse } from 'next/server';
import yahooFinance from '@/lib/yahoo';


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get('tickers');
  const range = searchParams.get('range') || '3mo'; // 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
  
  if (!tickersParam) {
    return NextResponse.json({ error: 'tickers parameter is required' }, { status: 400 });
  }

  const tickers = tickersParam.split(',').map(t => t.trim().toUpperCase());
  
  // Set interval based on range
  let interval: '1d' | '1wk' | '1mo' | '1m' | '2m' | '5m' | '15m' | '30m' | '60m' | '90m' | '1h' = '1d';
  if (range === '1d') interval = '5m';    // 5-min bars for intraday
  else if (range === '5d') interval = '15m';

  try {
    const results: Record<string, any[]> = {};
    
    // Fetch historical data for each ticker (yahooFinance handles concurrency reasonably well for small batches)
    await Promise.all(tickers.map(async (ticker) => {
        try {
            const historical = await yahooFinance.chart(ticker, {
                period1: getPeriod1(range),
                interval: interval,
            });
            results[ticker] = historical.quotes;
        } catch (e) {
            console.error(`Error fetching chart for ${ticker}`, e);
            results[ticker] = [];
        }
    }));

    return NextResponse.json(results);
  } catch (error: any) {
    console.error(`Error fetching charts:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function getPeriod1(range: string): Date | string {
    const d = new Date();
    switch (range) {
        // Use 5 days back for "1d" to ensure we get data even during weekends
        case '1d': d.setDate(d.getDate() - 5); break;
        // Use 10 days back for "5d" to cover holidays  
        case '5d': d.setDate(d.getDate() - 10); break;
        case '1mo': d.setMonth(d.getMonth() - 1); break;
        case '3mo': d.setMonth(d.getMonth() - 3); break;
        case '6mo': d.setMonth(d.getMonth() - 6); break;
        case '1y': d.setFullYear(d.getFullYear() - 1); break;
        case 'ytd': return `${d.getFullYear()}-01-01`;
        default: d.setMonth(d.getMonth() - 3); break;
    }
    return d;
}
