import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let cik = searchParams.get('cik');

  if (!cik) {
    return NextResponse.json({ error: 'CIK parameter is required' }, { status: 400 });
  }

  // Ensure CIK is exactly 10 digits as required by SEC APIs
  cik = cik.padStart(10, '0');

  try {
    const response = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
      headers: {
        'User-Agent': 'T-Terminal contact@t-terminal.local',
        'Accept': 'application/json'
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`SEC API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`Error fetching facts for CIK ${cik}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
