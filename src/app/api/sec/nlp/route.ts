import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

function getPeriod1(rangeStr: string): Date {
  const d = new Date();
  switch (rangeStr) {
    case '1d': d.setDate(d.getDate() - 1); break;
    case '1mo': d.setMonth(d.getMonth() - 1); break;
    case '3mo': d.setMonth(d.getMonth() - 3); break;
    case '6mo': d.setMonth(d.getMonth() - 6); break;
    case '1y': d.setFullYear(d.getFullYear() - 1); break;
    default: d.setMonth(d.getMonth() - 3); break;
  }
  return d;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker')?.toUpperCase();
  const range = searchParams.get('range') || '1y';

  if (!ticker) {
    return NextResponse.json({ error: 'ticker parameter is required' }, { status: 400 });
  }

  try {
    // 1. Get CIK for ticker
    const tickersRes = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: { 'User-Agent': 'T-Terminal contact@t-terminal.local' }
    });
    if (!tickersRes.ok) throw new Error("Could not fetch ticker map");
    const tickerMap = await tickersRes.json();
    
    let targetCik = null;
    for (const key in tickerMap) {
      if (tickerMap[key].ticker === ticker) {
        targetCik = tickerMap[key].cik_str.toString().padStart(10, '0');
        break;
      }
    }

    if (!targetCik) {
      return NextResponse.json({ error: `Could not find CIK for ${ticker}` }, { status: 404 });
    }

    // 2. Fetch submissions to find the latest 10-K
    const subRes = await fetch(`https://data.sec.gov/submissions/CIK${targetCik}.json`, {
        headers: { 'User-Agent': 'T-Terminal contact@t-terminal.local' },
        next: { revalidate: 86400 }
    });
    if (!subRes.ok) throw new Error("Could not fetch submissions");
    const subData = await subRes.json();

    const filings = subData.filings?.recent;
    if (!filings || !filings.form) {
       return NextResponse.json({ error: `Valid filings not found for ${ticker}` }, { status: 404 });
    }

    let index10k = -1;
    for (let i = 0; i < filings.form.length; i++) {
        if (filings.form[i] === '10-K') {
            index10k = i;
            break;
        }
    }

    if (index10k === -1) {
        return NextResponse.json({ error: `No recent 10-K found for ${ticker}` }, { status: 404 });
    }

    const accessionNo = filings.accessionNumber[index10k];
    const accessionNoNoDash = accessionNo.replace(/-/g, '');
    const primaryDoc = filings.primaryDocument[index10k];

    // SEC drops leading zeros in the CIK for the archive URLs
    const edgarCik = parseInt(targetCik, 10);
    // 3. Fetch the actual 10-K document (HTML or Text)
    const docUrl = `https://www.sec.gov/Archives/edgar/data/${edgarCik}/${accessionNoNoDash}/${primaryDoc}`;
    
    const docRes = await fetch(docUrl, {
        headers: { 'User-Agent': 'T-Terminal contact@t-terminal.local' }
    });
    if (!docRes.ok) throw new Error(`Could not fetch document at ${docUrl}`);
    
    const htmlContent = await docRes.text();

    // 4. Parse with Cheerio to extract text and do some lightweight NLP
    const $ = cheerio.load(htmlContent);
    
    // SEC filings have a lot of boilerplate, tables, and CSS. We just want text blocks.
    $('table, style, script, img, svg').remove();
    const rawText = $('body').text();
    
    // Basic regex cleaning
    let cleanText = rawText.replace(/\s+/g, ' ').trim();
    
    // Very naive extraction: Find "Item 1. Business" and take the next few thousand characters.
    const businessIndex = cleanText.search(/Item\s+1\.\s+Business/i);
    const riskIndex = cleanText.search(/Item\s+1A\.\s+Risk\s+Factors/i);
    const propsIndex = cleanText.search(/Item\s+2\.\s+Properties/i);
    const legalIndex = cleanText.search(/Item\s+3\.\s+Legal\s+Proceedings/i);
    const mineIndex = cleanText.search(/Item\s+4\.\s+Mine\s+Safety/i);
    const marketIndex = cleanText.search(/Item\s+5\.\s+Market\s+for/i);
    const mdaIndex = cleanText.search(/Item\s+7\.\s+Management['’]?s\s+Discussion/i);
    const quantIndex = cleanText.search(/Item\s+7A\.\s+Quantitative/i);
    
    let businessSummary = "Business description not found or unparseable. 10-K structure might differ.";
    let riskSummary = "Risk factors not found or unparseable. 10-K structure might differ.";
    let legalSummary = "Legal proceedings not found.";
    let mdaSummary = "Management's Discussion (Company Policies/Outlook) not found.";

    const extractSnippet = (startIndex: number, nextIndex: number, regexRemove: RegExp, maxLen = 2500) => {
        if (startIndex === -1) return null;
        let end = (nextIndex !== -1 && nextIndex > startIndex) ? nextIndex : startIndex + maxLen + 500;
        let snippet = cleanText.substring(startIndex, end).replace(regexRemove, '').trim();
        if (snippet.length > maxLen) snippet = snippet.substring(0, maxLen) + '...';
        return snippet;
    };

    businessSummary = extractSnippet(businessIndex, riskIndex, /Item\s+1\.\s+Business/i) || businessSummary;
    riskSummary = extractSnippet(riskIndex, propsIndex, /Item\s+1A\.\s+Risk\s+Factors/i) || riskSummary;
    legalSummary = extractSnippet(legalIndex, mineIndex, /Item\s+3\.\s+Legal\s+Proceedings/i) || legalSummary;
    mdaSummary = extractSnippet(mdaIndex, quantIndex, /Item\s+7\.\s+Management['’]?s\s+Discussion/i, 3000) || mdaSummary;

    // 5. Fetch Price Performance Data for Trader View
    let performance = { startPrice: 0, endPrice: 0, changePct: 0, period: range };
    try {
        const historical = await yahooFinance.chart(ticker, {
            period1: getPeriod1(range),
            interval: '1d',
        });
        if (historical.quotes && historical.quotes.length > 0) {
            const startPrice = historical.quotes[0].close || 0;
            const endPrice = historical.quotes[historical.quotes.length - 1].close || 0;
            const changePct = startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;
            performance = { startPrice, endPrice, changePct, period: range };
        }
    } catch(e) {
        console.warn("Could not fetch historical data for NLP view", e);
    }

    return NextResponse.json({
        ticker,
        cik: targetCik,
        companyName: subData.name,
        form: '10-K',
        filingDate: filings.filingDate[index10k],
        documentUrl: docUrl,
        performance,
        analysis: {
            businessOverview: businessSummary,
            riskFactors: riskSummary,
            legalProceedings: legalSummary,
            managementDiscussion: mdaSummary
        }
    });

  } catch (error: any) {
    console.error(`Error in NLP analysis:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
