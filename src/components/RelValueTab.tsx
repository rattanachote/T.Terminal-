import React, { useState, useEffect, useRef } from 'react';
import { createChart, IChartApi, LineSeries, ColorType } from 'lightweight-charts';

interface RelValueTabProps {
  ticker: string;
}

const formatNumber = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '--';
    if (val >= 1e12) return (val / 1e12).toFixed(2) + 'T';
    if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
    if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
    return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const formatPercent = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '--';
    return `${val > 0 ? '+' : ''}${val.toFixed(2)}%`;
};

const getColorClass = (val: number | null | undefined) => {
    if (val === null || val === undefined) return 'text-muted';
    return val > 0 ? 'text-green' : val < 0 ? 'text-red' : '';
};

const COLORS = ['#f5a623', '#00e5ff', '#d500f9', '#2979ff', '#00e676', '#ff3d00'];

export default function RelValueTab({ ticker }: RelValueTabProps) {
  const [peers, setPeers] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);

  // 1. Fetch Peers and Quotes
  useEffect(() => {
    async function loadData() {
       setLoading(true);
       try {
           // Get Peers
           const peerRes = await fetch(`/api/market/peers?ticker=${ticker}`);
           const peerData = await peerRes.json();
           const tickerList = [ticker, ...(peerData.peers || [])];
           setPeers(tickerList);

           // Get Quotes
           const quoteRes = await fetch(`/api/market/quotes?tickers=${tickerList.join(',')}`);
           const quoteData = await quoteRes.json();
           if (!quoteData.error) setQuotes(quoteData);

           // Get Historical Chart Data
           const chartRes = await fetch(`/api/market/chart?tickers=${tickerList.join(',')}&range=6mo`);
           const chartData = await chartRes.json();

           if (!chartData.error && chartContainerRef.current) {
               if (chartInstanceRef.current) {
                   chartInstanceRef.current.remove();
               }

               const chart = createChart(chartContainerRef.current, {
                   layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#888888' },
                   grid: { vertLines: { color: '#333333' }, horzLines: { color: '#333333' } },
                   rightPriceScale: { borderVisible: false },
                   timeScale: { borderVisible: false, timeVisible: true }
               });

               chartInstanceRef.current = chart;

               tickerList.forEach((sym, idx) => {
                   if (chartData[sym] && chartData[sym].length > 0) {
                       const series = chart.addSeries(LineSeries, {
                           color: COLORS[idx % COLORS.length],
                           lineWidth: sym === ticker ? 3 : 1.5,
                           title: sym
                       });

                       const safeData = chartData[sym]
                          .filter((d: any) => d.close !== null)
                          .map((d: any) => {
                              const dt = new Date(d.date);
                              return {
                                  time: `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`,
                                  value: d.close
                              };
                          });

                       series.setData(safeData);
                   }
               });
               chart.timeScale().fitContent();
           }

       } catch (e) {
           console.error("Failed to fetch Rel Value data", e);
       } finally {
           setLoading(false);
       }
    }
    loadData();

    return () => {
        if (chartInstanceRef.current) {
            chartInstanceRef.current.remove();
            chartInstanceRef.current = null;
        }
    };
  }, [ticker]);

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Calculating relative valuation for {ticker} against peers...</div>;

  return (
    <div className="responsive-flex" style={{ height: '100%', overflow: 'hidden' }}>

        {/* Chart Area */}
        <div className="bg-panel" style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: 'var(--text-muted)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="text-amber" style={{ fontWeight: 'bold' }}>PEER PERFORMANCE VS {ticker} (6M)</span>
                <div style={{ display: 'flex', gap: '12px', fontSize: '10px' }}>
                    {peers.map((p, i) => (
                        <div key={`${p}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: 8, height: 8, backgroundColor: COLORS[i % COLORS.length], borderRadius: '50%' }}></div>
                            <span style={{ fontWeight: p === ticker ? 'bold' : 'normal', color: p === ticker ? '#fff' : '#aaa' }}>{p}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div ref={chartContainerRef} style={{ flex: 1, minHeight: 0 }} />
        </div>

        {/* Data Grid Area */}
        <div className="bg-panel" style={{ flex: '1 1 50%', overflowY: 'auto' }}>
            <div style={{ color: 'var(--text-muted)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span className="text-amber" style={{ fontWeight: 'bold' }}>RELATIVE VALUATION GRID</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Mkt Cap<br/><span style={{fontSize: '10px', color: 'var(--text-muted)'}}>(USD)</span></th>
                  <th>Last Px<br/><span style={{fontSize: '10px', color: 'var(--text-muted)'}}>(USD)</span></th>
                  <th>Chg Pct<br/><span style={{fontSize: '10px', color: 'var(--text-muted)'}}>1D</span></th>
                  <th>Chg Pct<br/><span style={{fontSize: '10px', color: 'var(--text-muted)'}}>1M</span></th>
                  <th>Rev Gr<br/><span style={{fontSize: '10px', color: 'var(--text-muted)'}}>YoY</span></th>
                  <th>EPS Gr<br/><span style={{fontSize: '10px', color: 'var(--text-muted)'}}>YoY</span></th>
                  <th>P/E</th>
                  <th>ROE</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((row) => (
                  <tr key={row.ticker} style={{ backgroundColor: row.ticker === ticker ? 'rgba(245, 166, 35, 0.1)' : 'transparent' }}>
                    <td style={{ fontWeight: 'bold', color: row.ticker === ticker ? 'var(--accent-amber)' : 'var(--text-primary)' }}>{row.ticker}</td>
                    <td className="text-amber">{formatNumber(row.mktCap)}</td>
                    <td className="text-cyan">{row.lastPx?.toFixed(2) || '--'}</td>
                    <td className={getColorClass(row.chg1D)}>{formatPercent(row.chg1D)}</td>
                    <td className={getColorClass(row.chg1M)}>{formatPercent(row.chg1M)}</td>
                    <td className={getColorClass(row.rev1Yr)}>{formatPercent(row.rev1Yr)}</td>
                    <td className={getColorClass(row.eps1Yr)}>{formatNumber(row.eps1Yr)}</td>
                    <td>{row.pe ? row.pe.toFixed(2) : '--'}</td>
                    <td className={getColorClass(row.roe)}>{formatPercent(row.roe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>

    </div>
  );
}
