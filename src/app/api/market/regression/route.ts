import { NextResponse } from 'next/server';
import yahooFinance from '@/lib/yahoo';
import * as ss from 'simple-statistics';

const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 Hours

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker')?.toUpperCase();
  const benchmark = searchParams.get('benchmark')?.toUpperCase() || '^GSPC'; // S&P 500

  if (!ticker) {
    return NextResponse.json({ error: 'ticker parameter is required' }, { status: 400 });
  }

  const cacheKey = `reg_${ticker}_${benchmark}`;
  const now = Date.now();
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }
  }

  try {
    const period1 = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const period2 = new Date().toISOString().split('T')[0];
    
    // Performance optimization: Cache raw benchmark data separately to avoid redundant fetches
    const fetchChartData = async (sym: string) => {
        const rawCacheKey = `raw_chart_${sym}_1d_1y`;
        if (cache.has(rawCacheKey)) {
            const cached = cache.get(rawCacheKey)!;
            if (now - cached.timestamp < 30 * 60 * 1000) return cached.data; // 30 min TTL for raw prices
        }
        const chart = await yahooFinance.chart(sym, { period1, period2, interval: '1d' });
        const quotes = chart.quotes || [];
        cache.set(rawCacheKey, { data: quotes, timestamp: now });
        return quotes;
    };

    const [tickerData, benchData] = await Promise.all([
        fetchChartData(ticker),
        fetchChartData(benchmark)
    ]);

    // Align data by date and calculate daily returns
    const benchMap = new Map();
    benchData.forEach((d: any) => {
        const dateKey = d.date instanceof Date ? d.date.toISOString().split('T')[0] : String(d.date).split('T')[0];
        if (d.close) benchMap.set(dateKey, d.close);
    });

    const returns: [number, number][] = []; // [benchReturn, tickerReturn]
    let prevBenchPrice = 0;
    let prevTickerPrice = 0;

    // Build aligned date list for time-series chart (rebased to 100)
    const alignedDates: string[] = [];
    const tickerPrices: number[] = [];
    const benchPrices: number[] = [];

    tickerData.forEach((d: any) => {
        if (!d.close) return;
        const dateStr = d.date instanceof Date ? d.date.toISOString().split('T')[0] : String(d.date).split('T')[0];
        const benchPrice = benchMap.get(dateStr);
        
        if (benchPrice) {
            alignedDates.push(dateStr);
            tickerPrices.push(d.close);
            benchPrices.push(benchPrice);

            if (prevBenchPrice > 0 && prevTickerPrice > 0) {
                const bReturn = (benchPrice - prevBenchPrice) / prevBenchPrice;
                const tReturn = (d.close - prevTickerPrice) / prevTickerPrice;
                returns.push([bReturn, tReturn]);
            }
            prevBenchPrice = benchPrice;
            prevTickerPrice = d.close;
        }
    });

    if (returns.length < 10) {
        return NextResponse.json({ error: 'Not enough overlapping data for regression' }, { status: 400 });
    }

    // Normalize both series to start at 100
    const tickerBase = tickerPrices[0] || 1;
    const benchBase  = benchPrices[0] || 1;
    const timeSeries = alignedDates.map((date, i) => ({
        date,
        ticker: (tickerPrices[i] / tickerBase) * 100,
        bench:  (benchPrices[i] / benchBase) * 100,
    }));

    // Run simple-statistics linear regression
    const linearRegression = ss.linearRegression(returns);
    const linearRegressionLine = ss.linearRegressionLine(linearRegression);
    const rSquared = ss.rSquared(returns, linearRegressionLine);

    const scatterData = returns.map(r => ({ x: r[0], y: r[1] }));

    const data = {
        ticker,
        benchmark,
        beta: linearRegression.m,
        alpha: linearRegression.b,
        rSquared: rSquared,
        scatter: scatterData,
        count: returns.length,
        timeSeries, // normalized 1Y daily prices for relative performance chart
    };

    cache.set(cacheKey, { data, timestamp: now });
    return NextResponse.json(data);

  } catch (error: any) {
    console.error(`Error calculating regression for ${ticker}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
