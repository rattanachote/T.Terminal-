'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createChart, IChartApi, LineSeries, ColorType } from 'lightweight-charts';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Line, LineChart } from 'recharts';

interface RelIndexTabProps {
  ticker: string;
}

const fmt4 = (v: number | null | undefined) => v == null ? '--' : v.toFixed(4);

export default function RelIndexTab({ ticker }: RelIndexTabProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [benchmark, setBenchmark] = useState('^GSPC');
  const [benchInput, setBenchInput] = useState('^GSPC');

  const chartRef = useRef<HTMLDivElement>(null);
  const chartApi = useRef<IChartApi | null>(null);
  const tickerSeries = useRef<any>(null);
  const benchSeries  = useRef<any>(null);
  const lastPointsRef = useRef<{ ticker: any, bench: any }>({ ticker: null, bench: null });

  // ── Fetch regression + timeSeries ──────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError('');
    setData(null);
    async function fetchData() {
      try {
        const res  = await fetch(`/api/market/regression?ticker=${ticker}&benchmark=${benchmark}`);
        const json = await res.json();
        if (json.error) { setError(json.error); return; }
        setData(json);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [ticker, benchmark]);

  // ── Build / update the Relative Performance chart ──────────────────────
  useEffect(() => {
    if (!chartRef.current || !data?.timeSeries?.length) return;

    // Create chart lazily
    if (!chartApi.current) {
      chartApi.current = createChart(chartRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#888888',
        },
        grid: { vertLines: { color: '#252525' }, horzLines: { color: '#252525' } },
        crosshair: { mode: 1 },
        rightPriceScale: {
          borderVisible: false,
          scaleMargins: { top: 0.05, bottom: 0.05 },
        },
        timeScale: { borderVisible: false, timeVisible: false },
      });

      tickerSeries.current = chartApi.current.addSeries(LineSeries, {
        color: '#f5a623',
        lineWidth: 2,
        title: ticker,
      });
      benchSeries.current = chartApi.current.addSeries(LineSeries, {
        color: '#555555',
        lineWidth: 1,
        title: benchmark,
      });
    }

    const ts: any[] = data.timeSeries;
    
    // Process points: map and deduplicate (API is already sorted by date)
    const processPoints = (mapFn: (d: any) => any) => {
        const points = ts.map(mapFn);
        return points.filter((p, i, arr) => i === 0 || p.time !== arr[i - 1].time);
    };

    const tickerPoints = processPoints(d => ({ time: d.date, value: d.ticker }));
    const benchPoints  = processPoints(d => ({ time: d.date, value: d.bench }));

    tickerSeries.current?.setData(tickerPoints);
    benchSeries.current?.setData(benchPoints);

    if (tickerPoints.length > 0) Object.assign(lastPointsRef.current, { ticker: tickerPoints[tickerPoints.length - 1] });
    if (benchPoints.length > 0) Object.assign(lastPointsRef.current, { bench: benchPoints[benchPoints.length - 1] });

    chartApi.current?.timeScale().fitContent();
  }, [data, ticker]);

  // ── Resize observer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return;
    const ro = new ResizeObserver(() => {
      if (chartRef.current && chartApi.current) {
        chartApi.current.applyOptions({
          width:  chartRef.current.clientWidth,
          height: chartRef.current.clientHeight,
        });
      }
    });
    ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Live Chart Simulation (random walk for last point) ──────────────────
  useEffect(() => {
    if (!tickerSeries.current || !benchSeries.current) return;
    
    const interval = setInterval(() => {
      const lastTicker = lastPointsRef.current.ticker;
      const lastBench  = lastPointsRef.current.bench;
      
      if (lastTicker) {
        const volatility = 0.05; // 0.05 index points
        const newValue = lastTicker.value + (Math.random() - 0.5) * volatility;
        const nextPoint = { time: lastTicker.time, value: newValue };
        tickerSeries.current?.update(nextPoint);
        lastPointsRef.current.ticker = nextPoint;
      }
      
      if (lastBench) {
        const volatility = 0.02; // S&P moves less
        const newValue = lastBench.value + (Math.random() - 0.5) * volatility;
        const nextPoint = { time: lastBench.time, value: newValue };
        benchSeries.current?.update(nextPoint);
        lastPointsRef.current.bench = nextPoint;
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [data, ticker]);

  // ── Cleanup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => { chartApi.current?.remove(); chartApi.current = null; };
  }, [ticker, benchmark]);

  // Regression line overlay for scatter - memoized for performance
  const regPoints = useMemo(() => {
    if (!data?.scatter) return [];
    const { scatter, beta, alpha } = data;
    const xVals = scatter.map((d: any) => d.x);
    if (!xVals.length) return [];
    const xMin = Math.min(...xVals);
    const xMax = Math.max(...xVals);
    return [
      { x: xMin, y: alpha + beta * xMin },
      { x: xMax, y: alpha + beta * xMax },
    ];
  }, [data]);

  if (loading) return (
    <div style={{ color: 'var(--text-muted)', padding: '20px' }}>
      Running OLS regression vs S&amp;P 500 for {ticker}…
    </div>
  );
  if (error || !data) return (
    <div style={{ color: '#ff5555', padding: '20px' }}>
      {error || 'No data available.'}
    </div>
  );


  return (
    <div className="responsive-flex" style={{ height: '100%', overflow: 'hidden' }}>

      {/* ── Left Column: Scatter + Stats ──────────────────────────────── */}
      <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>

        {/* Scatter Plot */}
        <div className="bg-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="text-amber" style={{ fontWeight: 'bold' }}>LINEAR REGRESSION</span>
              {' '}» {ticker} vs {benchmark} (1Y Daily)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '9px' }}>BENCH:</span>
              <input 
                value={benchInput}
                onChange={e => setBenchInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && setBenchmark(benchInput)}
                style={{ 
                  background: '#1a1a1a', border: '1px solid #333', color: '#888',
                  fontSize: '9px', width: '60px', padding: '2px 4px', textAlign: 'center'
                }}
              />
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis
                  type="number" dataKey="x" name={`${benchmark} Return`}
                  stroke="#555" tick={{ fontSize: 9 }} domain={['auto', 'auto']}
                  tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                />
                <YAxis
                  type="number" dataKey="y" name={`${ticker} Return`}
                  stroke="#555" tick={{ fontSize: 9 }} domain={['auto', 'auto']}
                  tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                />
                {/* Regression line */}
                <Line
                  data={regPoints} type="linear" dataKey="y"
                  stroke="#ff3b3b" strokeWidth={2} dot={false}
                  legendType="none" isAnimationActive={false}
                />
                <Scatter 
                  name="Returns" data={data.scatter} 
                  fill="var(--accent-cyan)" opacity={0.7} r={2} 
                  isAnimationActive={false}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stats Table */}
        <div className="bg-panel" style={{ flex: '0 0 auto' }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
            <span className="text-amber" style={{ fontWeight: 'bold' }}>ADVANCED STATISTICS</span>
            {' '}» {benchmark} Benchmark
          </div>
          <table className="data-table" style={{ border: 'none', width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ border: 'none', color: 'var(--text-secondary)' }}>Linear Beta (β)</td>
                <td style={{ border: 'none', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{fmt4(data.beta)}</td>
                <td style={{ border: 'none', color: '#555', fontSize: '9px' }}>
                  {data.beta > 1.5 ? '▲ High volatility vs market' : data.beta < 0.7 ? '▼ Defensive' : '≈ Market-like'}
                </td>
              </tr>
              <tr>
                <td style={{ border: 'none', color: 'var(--text-secondary)' }}>Alpha (α)</td>
                <td style={{ border: 'none', color: data.alpha >= 0 ? '#00c853' : '#ff3b3b', fontWeight: 'bold' }}>{fmt4(data.alpha)}</td>
                <td style={{ border: 'none', color: '#555', fontSize: '9px' }}>
                  {data.alpha > 0 ? '✓ Positive excess return' : '✗ Negative excess return'}
                </td>
              </tr>
              <tr>
                <td style={{ border: 'none', color: 'var(--text-secondary)' }}>R-Squared (R²)</td>
                <td style={{ border: 'none', color: 'var(--text-primary)' }}>{fmt4(data.rSquared)}</td>
                <td style={{ border: 'none', color: '#555', fontSize: '9px' }}>
                  {((data.rSquared ?? 0) * 100).toFixed(1)}% variance explained
                </td>
              </tr>
              <tr>
                <td style={{ border: 'none', color: 'var(--text-secondary)' }}>Observations (N)</td>
                <td style={{ border: 'none', color: 'var(--text-primary)' }}>{data.count ?? '--'}</td>
                <td style={{ border: 'none', color: '#555', fontSize: '9px' }}>trading days</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Right Column: Real Relative Performance time-series ────────── */}
      <div className="bg-panel" style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            <span className="text-amber" style={{ fontWeight: 'bold' }}>RELATIVE PERFORMANCE</span>
            {' '}» 1Y Rebased to 100
          </span>
          <div style={{ display: 'flex', gap: '12px', fontSize: '9px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 10, height: 2, background: '#f5a623', display: 'inline-block' }} />
              {ticker}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 10, height: 2, background: '#555', display: 'inline-block' }} />
              {benchmark}
            </span>
          </div>
        </div>
        <div ref={chartRef} style={{ flex: 1, minHeight: 0 }} />
      </div>

    </div>
  );
}
