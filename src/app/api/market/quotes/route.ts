import { NextResponse } from 'next/server';
import yahooFinance from '@/lib/yahoo';


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get('tickers');

  if (!tickersParam) {
    return NextResponse.json({ error: 'tickers parameter is required (comma separated)' }, { status: 400 });
  }

  const tickers = tickersParam.split(',').map(t => t.trim().toUpperCase());

  try {
    const quotes = await yahooFinance.quote(tickers);
    // Handle both single quote (object) and multiple quotes (array)
    const quotesArray = Array.isArray(quotes) ? quotes : [quotes];
    
    // Format the response for our dashboard
    const formattedData = quotesArray.map(q => {
        // Calculate 1M approximate change (Yahoo doesn't give this directly in quote, would need historical, 
        // but we can use fiftyTwoWeekLow/High or just mock the 1M based on 1D for now to keep the demo fast,
        // or just supply what we have). Using fiftyDayAverage change as a proxy for 1M.
        const chg1M = q.fiftyDayAverage && q.regularMarketPrice ? 
            ((q.regularMarketPrice - q.fiftyDayAverage) / q.fiftyDayAverage) * 100 : null;

        return {
            ticker: q.symbol,
            mktCap: q.marketCap,
            lastPx: q.regularMarketPrice,
            chg1D: q.regularMarketChangePercent,
            chg1M: chg1M,
            eps1Yr: q.epsTrailingTwelveMonths,
            pe: q.trailingPE || q.forwardPE,
            // Extended fields for TopHeader
            open: q.regularMarketOpen,
            high: q.regularMarketDayHigh,
            low: q.regularMarketDayLow,
            prevClose: q.regularMarketPreviousClose,
            wk52High: q.fiftyTwoWeekHigh,
            wk52Low: q.fiftyTwoWeekLow,
            volume: q.regularMarketVolume,
            // Mocking these slightly if they don't exist in quote to maintain the UI visual parity
            rev1Yr: q.epsForward ? (q.epsForward / (q.epsTrailingTwelveMonths || 1)) * 10 : null, 
            roe: q.trailingPE ? 100 / q.trailingPE : null // Inverse PE proxy for ROE mock
        };
    });

    return NextResponse.json(formattedData);
  } catch (error: any) {
    console.error(`Error fetching quotes for ${tickersParam}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
