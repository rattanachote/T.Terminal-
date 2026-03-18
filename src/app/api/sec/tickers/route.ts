import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: {
        'User-Agent': 'T-Terminal contact@t-terminal.local',
        'Accept': 'application/json'
      },
      next: { revalidate: 86400 } // Cache for 24 hours
    });

    if (!response.ok) {
      throw new Error(`SEC API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Convert SEC format to a simpler Record<string, { cik: string, title: string }>
    // Original SEC format: { "0": { "cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc." }, ... }
    const tickerMap: Record<string, { cik: string, title: string }> = {};
    for (const key in data) {
      const item = data[key];
      // SEC experts CIK to be 10 digits padded with zeroes
      tickerMap[item.ticker] = {
        cik: item.cik_str.toString().padStart(10, '0'),
        title: item.title
      };
    }

    return NextResponse.json(tickerMap);
  } catch (error: any) {
    console.error('Error fetching tickers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
