'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createChart, AreaSeries, ColorType, IChartApi } from 'lightweight-charts';

interface OverviewTabProps {
  ticker: string;
}

export default function OverviewTab({ ticker }: OverviewTabProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chartPoints, setChartPoints] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const lastPointRef = useRef<{ time: number, value: number } | null>(null);


  // Fetch profile data
  useEffect(() => {
    async function fetchProfile() {
       setLoading(true);
       try {
           const res = await fetch(`/api/market/profile?ticker=${ticker}`);
           const json = await res.json();
           if (!json.error) setData(json);
       } catch (e) {
           console.error("Failed to fetch profile", e);
       } finally {
           setLoading(false);
       }
    }
    fetchProfile();
  }, [ticker]);

  // Fetch chart data separately  
  useEffect(() => {
    setChartLoading(true);
    setChartPoints([]);
    fetch(`/api/market/chart?tickers=${ticker}&range=1d`)
      .then(res => res.json())
      .then(json => {
        const raw: any[] = json[ticker] || [];
        const points = raw
          .filter((d: any) => d && d.close != null)
          .map((d: any) => {
            const dt = d.date instanceof Date ? d.date : new Date(d.date);
            const ts = Math.floor(dt.getTime() / 1000);
            return { time: ts as any, value: d.close as number };
          })
          .sort((a: any, b: any) => a.time - b.time)
          .filter((p: any, i: number, arr: any[]) => i === 0 || p.time !== arr[i-1].time);
        setChartPoints(points);
      })
      .catch(e => console.error('Chart fetch error', e))
      .finally(() => setChartLoading(false));
  }, [ticker]);

  // Render chart AFTER the container is in the DOM and we have data
  const renderChart = useCallback(() => {
    if (!chartContainerRef.current || chartLoading || !chartPoints.length) return;

    // Cleanup previous
    if (chartApiRef.current) {
      chartApiRef.current.remove();
      chartApiRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#888888' },
      grid: { vertLines: { color: '#252525' }, horzLines: { color: '#252525' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });
    chartApiRef.current = chart;

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#2979ff',
      topColor: 'rgba(41, 121, 255, 0.4)',
      bottomColor: 'rgba(41, 121, 255, 0.0)',
      lineWidth: 2,
    });

    series.setData(chartPoints);
    seriesRef.current = series;
    if (chartPoints.length > 0) {
      lastPointRef.current = chartPoints[chartPoints.length - 1];
    }
    chart.timeScale().fitContent();

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current && chartApiRef.current) {
        chartApiRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    });
    ro.observe(chartContainerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartApiRef.current = null;
    };
  }, [chartPoints, chartLoading]);

  // Trigger chart rendering when data is ready AND container exists (loading=false means DOM is rendered)
  useEffect(() => {
    if (loading) return; // Container not in DOM yet
    const cleanup = renderChart();
    return () => { cleanup?.(); };
  }, [loading, renderChart]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartApiRef.current) {
        chartApiRef.current.remove();
        chartApiRef.current = null;
      }
    };
  }, []);

  // Live Chart Simulation (random walk)
  useEffect(() => {
    if (!seriesRef.current || !lastPointRef.current) return;
    const interval = setInterval(() => {
      const series = seriesRef.current;
      const lastPoint = lastPointRef.current;
      if (!series || !lastPoint) return;

      const newTime = lastPoint.time + 60; // advance 60 seconds
      const volatility = lastPoint.value * 0.0005; // 0.05% swing based on current price
      const newValue = lastPoint.value + (Math.random() - 0.5) * volatility;

      const nextPoint = { time: newTime as any, value: newValue };
      series.update(nextPoint);
      lastPointRef.current = nextPoint;
    }, 1500);

    return () => clearInterval(interval);
  }, [chartPoints]); // Restart interval if data changes

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '20px' }}>Loading {ticker} Overview...</div>;
  if (!data) return <div className="text-red">Failed to load payload.</div>;

  const profile = data.profile || {};
  const stats = data.stats || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', width: '100%', paddingRight: '16px' }}>
        
        {/* Company Header Block */}
        <div style={{ padding: 'var(--spacing-md)', borderBottom: '1px solid var(--border-color)' }}>
            <h2 className="text-amber" style={{ fontSize: 'var(--font-size-lg)', marginBottom: '8px' }}>
                {profile.longName || ticker} CORP
            </h2>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', gap: '16px' }}>
                 <span>{profile.sector || 'N/A'}</span>
                 <span>{profile.industry || 'N/A'}</span>
                 <span>Employees: {profile.fullTimeEmployees?.toLocaleString() || 'N/A'}</span>
            </div>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {profile.longBusinessSummary ? (profile.longBusinessSummary.substring(0, 400) + '...') : 'No description available.'}
            </p>
        </div>

        {/* Dense Grid Layout for Data */}
        <div className="responsive-flex" style={{ gap: '16px', minHeight: '300px' }}>
            
            {/* Chart Area */}
            <div className="bg-panel" style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  8) Price Chart | CP » {ticker} — Intraday (1D)
                </div>
                <div ref={chartContainerRef} style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  {chartLoading && (
                    <div style={{ 
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#555', fontSize: '11px', zIndex: 2,
                    }}>
                      Loading chart data...
                    </div>
                  )}
                  {!chartLoading && chartPoints.length === 0 && (
                    <div style={{ 
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#555', fontSize: '11px', zIndex: 2,
                    }}>
                      No chart data available (market may be closed)
                    </div>
                  )}
                </div>
            </div>

            {/* Estimates & Info Grid */}
            <div className="bg-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', fontSize: 'var(--font-size-xs)' }}>
                <div>
                     <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>9) Estimates | EE »</div>
                     <table className="data-table" style={{ border: 'none' }}>
                         <tbody>
                             <tr><td style={{border: 'none', padding: 2}}>P/E</td><td style={{border: 'none', padding: 2, color: 'var(--accent-cyan)'}}>{stats.forwardPE?.toFixed(2) || 'N/A'}</td></tr>
                             <tr><td style={{border: 'none', padding: 2}}>Est P/E</td><td style={{border: 'none', padding: 2, color: 'var(--accent-cyan)'}}>{stats.trailingPE?.toFixed(2) || 'N/A'}</td></tr>
                             <tr><td style={{border: 'none', padding: 2}}>Est EPS</td><td style={{border: 'none', padding: 2, color: 'var(--accent-cyan)'}}>{stats.forwardEps?.toFixed(2) || 'N/A'}</td></tr>
                             <tr><td style={{border: 'none', padding: 2}}>Beta</td><td style={{border: 'none', padding: 2, color: 'var(--accent-cyan)'}}>{stats.beta?.toFixed(2) || 'N/A'}</td></tr>
                         </tbody>
                     </table>
                </div>
                
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                     <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>13) Corporate Info</div>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--text-secondary)' }}>
                         <div>{profile.address1}</div>
                         <div>{profile.city}, {profile.state} {profile.zip}</div>
                         <div>{profile.country}</div>
                         <div style={{ color: 'var(--accent-blue)', marginTop: '8px' }}>{profile.website}</div>
                     </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                     <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>15) Management | MGMT »</div>
                     <table className="data-table" style={{ border: 'none' }}>
                         <tbody>
                             {profile.companyOfficers?.slice(0,3).map((officer: any, i: number) => (
                                 <tr key={i}>
                                     <td style={{border: 'none', padding: 2, color: 'var(--text-primary)'}}>{officer.name}</td>
                                     <td style={{border: 'none', padding: 2, color: 'var(--text-muted)'}}>{officer.title?.substring(0, 20)}</td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                </div>
            </div>
            
        </div>
    </div>
  );
}
