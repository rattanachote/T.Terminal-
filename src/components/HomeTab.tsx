'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createChart, IChartApi, AreaSeries, ColorType } from 'lightweight-charts';

interface HomeTabProps {
  onSelectTicker: (ticker: string) => void;
}

type WatchCategory = 'gainers' | 'losers' | 'active' | 'custom';



const INDEX_SYMBOLS = ['^GSPC', '^IXIC', '^DJI', '^RUT', '^VIX'];
const INDEX_LABELS: Record<string, string> = {
  '^GSPC': 'S&P 500', '^IXIC': 'NASDAQ', '^DJI': 'DOW', '^RUT': 'RUSSELL', '^VIX': 'VIX'
};
const REFRESH_MS = 30_000; // 30 second real-time refresh

const fmt = (v: number | null | undefined, d = 2) => v == null ? '--' : v.toFixed(d);
const fmtBig = (v: number | null | undefined) => {
  if (v == null) return '--';
  if (v >= 1e12) return (v / 1e12).toFixed(2) + 'T';
  if (v >= 1e9)  return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6)  return (v / 1e6).toFixed(2) + 'M';
  return v.toLocaleString();
};
const colorPct = (v: number | null | undefined) => {
  if (v == null) return '#888';
  return v > 0 ? '#00c853' : v < 0 ? '#ff3b3b' : '#888';
};

export default function HomeTab({ onSelectTicker }: HomeTabProps) {
  const [indices, setIndices]     = useState<any[]>([]);
  const [screener, setScreener]   = useState<any>({});
  const [category, setCategory]   = useState<WatchCategory>('gainers');
  const [customInput, setCustomInput] = useState('');
  const [customTickers, setCustomTickers] = useState<string[]>(['AAPL','MSFT','GOOGL','AMZN','META']);
  const [customQuotes, setCustomQuotes] = useState<any[]>([]);
  const [topTickers, setTopTickers] = useState<string[]>(['^GSPC', '^IXIC', '^DJI', '^RUT', '^VIX']);
  const [topQuotes, setTopQuotes] = useState<any[]>([]);
  const [chartData, setChartData] = useState<Record<string, any[]>>({});
  const [chartTickers, setChartTickers] = useState<{symbol: string, color: string, label: string}[]>([
    { symbol: '^GSPC', color: '#f5a623', label: '^GSPC' },
    { symbol: '^IXIC', color: '#00d4ff', label: '^IXIC' },
  ]);
  const [chartInput1, setChartInput1] = useState('^GSPC');
  const [chartInput2, setChartInput2] = useState('^IXIC');
  const [loadingScreener, setLoadingScreener] = useState(true);
  const [loadingTop, setLoadingTop] = useState(true);
  const [loadingChart, setLoadingChart]   = useState(true);
  const [lastRefresh, setLastRefresh] = useState('');

  const chartRef = useRef<HTMLDivElement>(null);
  const chartApi = useRef<IChartApi | null>(null);
  const seriesMap = useRef<Record<string, any>>({});
  const lastPointsRef = useRef<Record<string, { time: number, value: number }>>({});


  const fetchScreener = useCallback(async () => {
    try {
      const res = await fetch('/api/market/screener?category=all');
      const json = await res.json();
      if (!json.error) {
        setScreener(json);
      }
    } catch (e) { console.error('screener', e); }
    finally { setLoadingScreener(false); }
  }, []);

  // ── Fetch top editable index quotes ──────────────────────────────────────────
  const fetchTop = useCallback(async (tickers: string[]) => {
    setLoadingTop(true);
    try {
      const symbols = tickers.map(t => t || 'SPY').join(',');
      const res = await fetch(`/api/market/quotes?tickers=${symbols}`);
      const json = await res.json();
      if (!json.error) {
        // preserve order
        const lookup = new Map(json.map((q: any) => [q.ticker || q.symbol, q]));
        const ordered = tickers.map(t => lookup.get(t) || { ticker: t, lastPx: 0, chg1D: 0, prevClose: 0 });
        setTopQuotes(ordered);
      }
    } catch (e) { console.error('top', e); }
    finally { setLoadingTop(false); }
  }, []);

  // ── Fetch intraday chart for selected tickers ───────────────────────────
  const fetchChart = useCallback(async () => {
    try {
      const symbols = chartTickers.map(t => t.symbol).join(',');
      const res = await fetch(`/api/market/chart?tickers=${symbols}&range=1d`);
      const json = await res.json();
      setChartData(json);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (e) { console.error('chart', e); }
    finally { setLoadingChart(false); }
  }, [chartTickers]);

  // ── Fetch custom tickers quotes ──────────────────────────────────────────
  const fetchCustom = useCallback(async (tickers: string[]) => {
    if (!tickers.length) return;
    try {
      const res = await fetch(`/api/market/quotes?tickers=${tickers.join(',')}`);
      const json = await res.json();
      if (!json.error) setCustomQuotes(json);
    } catch (e) { console.error('custom', e); }
  }, []);

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetchScreener();
    fetchChart();
    fetchCustom(customTickers);
    fetchTop(topTickers);

    const interval = setInterval(() => {
      fetchChart();
      fetchScreener();
      fetchTop(topTickers);
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchScreener, fetchChart, fetchCustom, fetchTop, topTickers]);

  useEffect(() => { fetchCustom(customTickers); }, [customTickers, fetchCustom]);
  useEffect(() => { fetchTop(topTickers); }, [topTickers, fetchTop]);

  // ── Build / update lightweight-charts ────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return;
    if (!chartApi.current) {
      chartApi.current = createChart(chartRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#888888',
        },
        grid: { vertLines: { color: '#252525' }, horzLines: { color: '#252525' } },
        crosshair: { mode: 1 },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      });
    }

    const chart = chartApi.current;
    // Remove old series
    Object.values(seriesMap.current).forEach(s => { try { chart.removeSeries(s); } catch {} });
    seriesMap.current = {};

    chartTickers.forEach(({ symbol, color, label }) => {
      const raw: any[] = chartData[symbol] || [];
      if (!raw.length) return;

      // Normalize to % change from first close
      const base = raw[0]?.close ?? raw[0]?.open ?? 1;
      const points = raw
        .filter(d => d && d.close != null)
        .map(d => {
          const dt = d.date instanceof Date ? d.date : new Date(d.date);
          // Use Unix timestamp (seconds) for intraday data
          const ts = Math.floor(dt.getTime() / 1000);
          return { time: ts as any, value: ((d.close - base) / base) * 100 };
        })
        // sort by timestamp ascending
        .sort((a, b) => a.time - b.time)
        // deduplicate by timestamp
        .filter((p, i, arr) => i === 0 || p.time !== arr[i-1].time);

      if (!points.length) return;

      const series = chart.addSeries(AreaSeries, {
        lineColor: color,
        topColor: color + '33',
        bottomColor: color + '00',
        lineWidth: 2,
        title: label,
      });
      series.setData(points);
      seriesMap.current[symbol] = series;
      // Store last point for simulation
      lastPointsRef.current[symbol] = points[points.length - 1];
    });

    chart.timeScale().fitContent();
    return () => {};
  }, [chartData]);

  // ── Live Chart Simulation (random walk) ──────────────────────────────────
  useEffect(() => {
    if (Object.keys(seriesMap.current).length === 0) return;
    
    const interval = setInterval(() => {
      chartTickers.forEach(({ symbol }) => {
        const series = seriesMap.current[symbol];
        const lastPoint = lastPointsRef.current[symbol];
        if (!series || !lastPoint) return;

        // Advance time by 60 seconds, random walk value
        const newTime = lastPoint.time + 60;
        const volatility = 0.05; // 0.05% swing
        const newValue = lastPoint.value + (Math.random() - 0.5) * volatility;

        const nextPoint = { time: newTime as any, value: newValue };
        series.update(nextPoint);
        lastPointsRef.current[symbol] = nextPoint; // update ref
      });
    }, 1500); // tick every 1.5 seconds

    return () => clearInterval(interval);
  }, [chartData]);

  // ── Resize observer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current || !chartApi.current) return;
    const ro = new ResizeObserver(() => {
      if (chartRef.current && chartApi.current) {
        chartApi.current.applyOptions({
          width: chartRef.current.clientWidth,
          height: chartRef.current.clientHeight,
        });
      }
    });
    ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => { chartApi.current?.remove(); chartApi.current = null; };
  }, []);

  // ── Get current list ─────────────────────────────────────────────────────
  const currentList: any[] = category === 'custom'
    ? customQuotes
    : (screener[category] || []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAddCustom = () => {
    const t = customInput.trim().toUpperCase();
    if (t && !customTickers.includes(t)) {
      setCustomTickers(prev => [...prev, t]);
    }
    setCustomInput('');
  };
  const handleRemoveCustom = (t: string) =>
    setCustomTickers(prev => prev.filter(x => x !== t));

  // ── Styles ───────────────────────────────────────────────────────────────
  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontSize: '10px', padding: '3px 10px', cursor: 'pointer', fontFamily: 'var(--font-mono)',
    fontWeight: active ? 'bold' : 'normal',
    color: active ? '#f5a623' : '#888',
    background: 'none', border: 'none', borderBottomWidth: '2px',
    borderBottomStyle: 'solid', borderBottomColor: active ? '#f5a623' : 'transparent',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', gap: '8px', overflow: 'hidden' }}>

      {/* ── Editable Top Tickers Strip ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {loadingTop && topQuotes.length === 0
          ? <div style={{ color: '#666', fontSize: '10px' }}>Loading top metrics...</div>
          : topTickers.map((ticker, idx) => {
              const q = topQuotes[idx] || {};
              const pct = q.chg1D ?? 0;
              const px = q.lastPx ?? 0;
              const prev = q.prevClose ?? px;
              const change = (px && prev) ? px - prev : 0;
              const col = colorPct(pct);
              return (
                <div
                  key={`${ticker}-${idx}`}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: '2px',
                    padding: '6px 12px', background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    minWidth: '100px', transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#f5a623')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-color)')}
                >
                  {/* Editable input for ticker */}
                  <input 
                    value={ticker}
                    onChange={(e) => {
                       const next = [...topTickers];
                       next[idx] = e.target.value.toUpperCase();
                       setTopTickers(next);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') fetchTop(topTickers); }}
                    onBlur={() => fetchTop(topTickers)}
                    style={{ 
                       background: 'transparent', border: 'none', borderBottom: '1px solid #333', 
                       color: '#888', fontSize: '9px', fontWeight: 'bold', width: '60px', 
                       outline: 'none', cursor: 'text', fontFamily: 'var(--font-mono)'
                    }}
                  />
                  {/* Clickable price block to navigate */}
                  <div 
                    onClick={() => onSelectTicker(ticker)} 
                    style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', marginTop: '4px' }}
                  >
                     <span style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                       {px > 0 ? px.toFixed(2) : '--'}
                     </span>
                     <span style={{ fontSize: '10px', color: col, fontWeight: 'bold' }}>
                       {change > 0 ? '+' : ''}{change.toFixed(2)} ({pct > 0 ? '+' : ''}{pct.toFixed(2)}%)
                     </span>
                  </div>
                </div>
              );
            })}
        <div style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: '9px', color: '#555', fontFamily: 'var(--font-mono)' }}>
          ⟳ {lastRefresh || '—'} (30s)
        </div>
      </div>

      {/* ── Main Body: Chart + Watchlist ─────────────────────────────────── */}
      <div className="responsive-flex" style={{ overflow: 'hidden' }}>

        {/* LEFT: Real-time Chart */}
        <div className="bg-panel" style={{ flex: '1 1 58%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
            <span className="text-amber" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'bold' }}>
              MARKET REAL-TIME — INTRADAY (1D)
            </span>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 10, height: 2, background: '#f5a623', display: 'inline-block' }} />
                <input 
                  value={chartInput1}
                  onChange={e => setChartInput1(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === 'Enter') setChartTickers(p => [{symbol: chartInput1 || 'SPY', color: '#f5a623', label: chartInput1 || 'SPY'}, p[1]]) }}
                  onBlur={() => setChartTickers(p => [{symbol: chartInput1 || 'SPY', color: '#f5a623', label: chartInput1 || 'SPY'}, p[1]])}
                  style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #333', color: '#aaa', fontSize: '9px', width: '40px', outline: 'none', textAlign: 'center', cursor: 'text' }}
                />
              </div>
              <span style={{ fontSize: '9px', color: '#555' }}>vs</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 10, height: 2, background: '#00d4ff', display: 'inline-block' }} />
                <input 
                  value={chartInput2}
                  onChange={e => setChartInput2(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === 'Enter') setChartTickers(p => [p[0], {symbol: chartInput2 || 'QQQ', color: '#00d4ff', label: chartInput2 || 'QQQ'}]) }}
                  onBlur={() => setChartTickers(p => [p[0], {symbol: chartInput2 || 'QQQ', color: '#00d4ff', label: chartInput2 || 'QQQ'}])}
                  style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #333', color: '#aaa', fontSize: '9px', width: '40px', outline: 'none', textAlign: 'center', cursor: 'text' }}
                />
              </div>
            </div>
          </div>
          {loadingChart
            ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '11px' }}>
                Loading real-time data...
              </div>
            : <div ref={chartRef} style={{ flex: 1, minHeight: 0 }} />
          }
        </div>

        {/* RIGHT: Watchlist */}
        <div className="bg-panel" style={{ flex: '1 1 40%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Category tabs */}
          <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #222', marginBottom: '8px', paddingBottom: '0' }}>
            {(['gainers','losers','active','custom'] as WatchCategory[]).map(cat => (
              <button key={cat} style={tabStyle(category === cat)} onClick={() => setCategory(cat)}>
                {cat === 'gainers' ? '▲ GAINERS' : cat === 'losers' ? '▼ LOSERS' : cat === 'active' ? '⚡ ACTIVE' : '★ CUSTOM'}
              </button>
            ))}
          </div>

          {/* Custom ticker input */}
          {category === 'custom' && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
              <input
                type="text"
                className="terminal-input"
                style={{ flex: 1, fontSize: '10px', padding: '3px 6px', background: '#111', border: '1px solid #333', color: '#ccc' }}
                placeholder="ADD TICKER (e.g. TSLA)"
                value={customInput}
                onChange={e => setCustomInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
              />
              <button
                onClick={handleAddCustom}
                style={{ fontSize: '10px', padding: '3px 8px', background: '#1a3a1a', border: '1px solid #2a6a2a', color: '#4caf50', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
              >
                + ADD
              </button>
            </div>
          )}

          {/* Table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: '60px' }}>TICKER</th>
                  <th>LAST PX</th>
                  <th>CHG%</th>
                  <th>MKT CAP</th>
                  <th>VOLUME</th>
                  {category === 'custom' && <th></th>}
                </tr>
              </thead>
              <tbody>
                {loadingScreener && category !== 'custom' ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#555' }}>Loading...</td></tr>
                ) : currentList.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#555' }}>No data</td></tr>
                ) : currentList.map((row: any) => {
                  const pct = row.changePct ?? row.chg1D ?? 0;
                  const col = colorPct(pct);
                  return (
                    <tr
                      key={row.ticker}
                      onClick={() => onSelectTicker(row.ticker)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontWeight: 'bold', color: '#e0e0e0' }}>{row.ticker}</td>
                      <td style={{ color: '#00d4ff', fontFamily: 'var(--font-mono)' }}>{fmt(row.lastPx)}</td>
                      <td style={{ color: col, fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                        {pct > 0 ? '+' : ''}{fmt(pct)}%
                      </td>
                      <td style={{ color: '#aaa' }}>{fmtBig(row.mktCap)}</td>
                      <td style={{ color: '#888' }}>{fmtBig(row.volume)}</td>
                      {category === 'custom' && (
                        <td>
                          <span
                            onClick={e => { e.stopPropagation(); handleRemoveCustom(row.ticker); }}
                            style={{ color: '#555', cursor: 'pointer', fontSize: '10px' }}
                          >✕</span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
