'use client';
import React, { useState, useEffect } from 'react';

interface NewsTabProps {
  ticker: string;
}

export default function NewsTab({ ticker }: NewsTabProps) {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PER_PAGE = 25;

  useEffect(() => {
    async function fetchNews() {
       setLoading(true);
       try {
           const res = await fetch(`/api/market/news?ticker=${ticker}`);
           const json = await res.json();
           if (!json.error) setNews(json);
       } catch (e) {
           console.error("Failed to fetch news", e);
       } finally {
           setLoading(false);
       }
    }
    fetchNews();
    setPage(1);
  }, [ticker]);

  function formatTime(raw: any): string {
    if (!raw) return '--';
    let d: Date;
    if (typeof raw === 'number') {
      d = raw > 1e12 ? new Date(raw) : new Date(raw * 1000);
    } else {
      d = new Date(raw);
    }
    if (isNaN(d.getTime())) return '--';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[d.getMonth()]} ${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '20px' }}>Fetching live feed for {ticker}...</div>;
  if (!news || news.length === 0) return <div className="text-muted" style={{ padding: '20px' }}>No news available for {ticker}.</div>;

  const totalPages = Math.ceil(news.length / PER_PAGE);
  const paginated = news.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* Header with page navigation */}
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 0', borderBottom: '1px solid var(--border-color)', marginBottom: '4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="text-amber" style={{ fontWeight: 'bold', fontSize: '10px' }}>REAL-TIME FEED</span>
          <span style={{ color: '#888', fontSize: '9px' }}>» {ticker} US Equity | Company News</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '9px', color: '#666' }}>
          {/* Per-page pagination tabs like reference */}
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => (
            <span 
              key={i}
              onClick={() => setPage(i + 1)}
              style={{
                padding: '2px 6px',
                cursor: 'pointer',
                color: page === i + 1 ? '#000' : '#888',
                backgroundColor: page === i + 1 ? 'var(--accent-amber)' : 'transparent',
                fontWeight: page === i + 1 ? 'bold' : 'normal',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {i + 1}
            </span>
          ))}
        </div>
      </div>

      {/* News table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '100px', whiteSpace: 'nowrap' }}>Date</th>
              <th style={{ width: '140px' }}>Source</th>
              <th>Headline</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((item, idx) => {
              const rowBg = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)';
              return (
                <tr 
                  key={idx} 
                  onClick={() => window.open(item.link, '_blank')} 
                  style={{ cursor: 'pointer', backgroundColor: rowBg }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(245,166,35,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = rowBg)}
                >
                  <td style={{ 
                    color: '#f5a623', 
                    fontFamily: 'var(--font-mono)', 
                    fontSize: '10px', 
                    whiteSpace: 'nowrap',
                    fontWeight: 'bold',
                  }}>
                    {formatTime(item.providerPublishTime)}
                  </td>
                  <td style={{ 
                    color: '#00d4ff', 
                    fontWeight: 'bold',
                    fontSize: '10px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '140px',
                  }}>
                    {item.publisher || 'Syndicated'}
                  </td>
                  <td style={{ 
                    color: '#e0e0e0',
                    whiteSpace: 'normal',
                    fontSize: '11px',
                    lineHeight: '1.4',
                  }}>
                    {item.title}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
