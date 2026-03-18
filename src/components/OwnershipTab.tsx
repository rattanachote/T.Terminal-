'use client';
import React, { useState, useEffect } from 'react';

interface OwnershipTabProps {
  ticker: string;
}

const formatNumber = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '--';
    if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
    if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
    if (val >= 1e3) return (val / 1e3).toFixed(1) + 'K';
    return val.toLocaleString();
};

const formatPercent = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '--';
    return `${(val * 100).toFixed(2)}%`;
};

const formatDate = (raw: any): string => {
    if (!raw) return '--';
    let d: Date;
    if (typeof raw === 'number') {
      d = raw > 1e12 ? new Date(raw) : new Date(raw * 1000);
    } else {
      d = new Date(raw);
    }
    if (isNaN(d.getTime())) return '--';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

type SubTab = 'current' | 'insider' | 'debt';

export default function OwnershipTab({ ticker }: OwnershipTabProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<SubTab>('current');
  const [filterText, setFilterText] = useState('');
  const [balanceSheet, setBalanceSheet] = useState<any>(null);
  const [loadingBS, setLoadingBS] = useState(false);
  const [errorObj, setErrorObj] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOwnership() {
       setLoading(true);
       try {
           const res = await fetch(`/api/market/ownership?ticker=${ticker}`);
           const json = await res.json();
           if (json.error) {
               setErrorObj(json.error);
           } else {
               setData(json);
           }
       } catch (e: any) {
           setErrorObj(e.message || "Failed to fetch ownership");
           console.error("Failed to fetch ownership", e);
       } finally {
           setLoading(false);
       }
    }
    fetchOwnership();
  }, [ticker]);

  // Fetch balance sheet for debt tab
  useEffect(() => {
    if (subTab !== 'debt') return;
    async function fetchBS() {
      setLoadingBS(true);
      try {
        const res = await fetch(`/api/market/profile?ticker=${ticker}`);
        const json = await res.json();
        if (!json.error) setBalanceSheet(json.financials || json.stats || {});
      } catch (e) { console.error('BS fetch', e); }
      finally { setLoadingBS(false); }
    }
    fetchBS();
  }, [subTab, ticker]);

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '20px' }}>Fetching ownership structure for {ticker}...</div>;
  if (errorObj || !data || Object.keys(data).length === 0) {
    return (
      <div className="text-muted" style={{ padding: '20px' }}>
        <p style={{ color: 'var(--accent-red)', marginBottom: '8px' }}>{errorObj ? `Data Error: ${errorObj}` : ''}</p>
        No ownership data available for {ticker}. (Note: ETFs, Indices, or recently listed companies may not have SEC 13F/Form 4 filings).
      </div>
    );
  }

  const funds = data.funds || [];
  const insiders = data.insiders || [];
  const majorHolders = data.majorHolders || {};

  // Filter funds by search
  const filtered = filterText
    ? funds.filter((f: any) => f.organization?.toLowerCase().includes(filterText.toLowerCase()))
    : funds;

  const subTabStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 14px',
    fontSize: '10px',
    cursor: 'pointer',
    fontWeight: active ? 'bold' : 'normal',
    color: active ? '#000' : '#88aaff',
    backgroundColor: active ? 'var(--accent-amber)' : 'transparent',
    border: 'none',
    fontFamily: 'var(--font-mono)',
    borderRight: '1px solid #333',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Ticker + Search bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
        <input
          type="text"
          value={ticker}
          readOnly
          style={{
            background: '#111', border: '1px solid #333', color: '#fff', padding: '4px 8px',
            fontSize: '12px', fontFamily: 'var(--font-mono)', width: '100px'
          }}
        />
        {/* Sub-tabs */}
        <div style={{ display: 'flex', border: '1px solid #333' }}>
          <button style={subTabStyle(subTab === 'current')} onClick={() => setSubTab('current')}>1) Current</button>
          <button style={subTabStyle(subTab === 'insider')} onClick={() => setSubTab('insider')}>2) Insider Transactions</button>
          <button style={subTabStyle(subTab === 'debt')} onClick={() => setSubTab('debt')}>3) Debt</button>
        </div>
      </div>

      {/* Source info row */}
      <div style={{ display: 'flex', gap: '20px', padding: '6px 0', fontSize: '9px', color: '#888', borderBottom: '1px solid var(--border-color)' }}>
        <span>Ticker: <span style={{ color: '#f5a623' }}>{ticker}</span></span>
        <span>Shrs Out: <span style={{ color: '#e0e0e0' }}>{formatNumber(majorHolders.sharesOutstanding || null)}</span></span>
        <span>Inst % Ot: <span style={{ color: '#e0e0e0' }}>{formatPercent(majorHolders.institutionsPercentHeld)}</span></span>
        <span>Holders: <span style={{ color: '#e0e0e0' }}>{formatNumber(majorHolders.institutionsCount)}</span></span>
        <span style={{ marginLeft: 'auto' }}>Source: <span style={{ color: '#e0e0e0' }}>13F/SEC EDGAR</span></span>
      </div>

      {/* ─── Sub-tab: Current ─── */}
      {subTab === 'current' && (
        <div className="responsive-flex" style={{ overflow: 'hidden', paddingTop: '8px' }}>
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ marginBottom: '6px' }}>
              <input type="text" placeholder="Filter holders..." value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                style={{ background: '#111', border: '1px solid #333', color: '#ccc', padding: '3px 6px', fontSize: '10px', width: '200px', fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '30px' }}>#</th>
                    <th>Holder Name</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((fund: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ color: '#888' }}>{idx + 1}</td>
                      <td style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>{fund.organization}</td>
                      <td style={{ color: '#888', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>13F</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No holders found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
              <span className="text-amber" style={{ fontWeight: 'bold', fontSize: '10px' }}>OWNERSHIP SUMMARY</span>
            </div>
            <table className="data-table" style={{ border: 'none' }}>
              <tbody>
                <tr><td style={{ border: 'none', color: 'var(--text-secondary)' }}>% Held by Insiders</td>
                    <td style={{ border: 'none', color: 'var(--text-primary)' }}>{formatPercent(majorHolders.insidersPercentHeld)}</td></tr>
                <tr><td style={{ border: 'none', color: 'var(--text-secondary)' }}>% Held by Institutions</td>
                    <td style={{ border: 'none', color: 'var(--text-primary)' }}>{formatPercent(majorHolders.institutionsPercentHeld)}</td></tr>
                <tr><td style={{ border: 'none', color: 'var(--text-secondary)' }}>Float Held by Inst</td>
                    <td style={{ border: 'none', color: 'var(--text-primary)' }}>{formatPercent(majorHolders.institutionsFloatPercentHeld)}</td></tr>
                <tr><td style={{ border: 'none', color: 'var(--text-secondary)' }}>Num. of Institutions</td>
                    <td style={{ border: 'none', color: 'var(--text-primary)' }}>{formatNumber(majorHolders.institutionsCount)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Sub-tab: Insider Transactions ─── */}
      {subTab === 'insider' && (
        <div style={{ flex: 1, overflow: 'hidden', paddingTop: '8px' }}>
          {insiders.length === 0 ? (
            <div style={{ color: '#555', fontSize: '11px', textAlign: 'center', paddingTop: '40px' }}>
              No insider transactions reported for {ticker}.
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', height: '100%' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Insider</th>
                    <th>Relation</th>
                    <th>Transaction</th>
                    <th style={{ textAlign: 'right' }}>Shares</th>
                    <th style={{ textAlign: 'right' }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {insiders.slice(0, 30).map((tx: any, idx: number) => {
                    const isBuy = (tx.transactionText || '').toLowerCase().includes('purchase') ||
                                  (tx.transactionText || '').toLowerCase().includes('buy') ||
                                  (tx.transactionText || '').toLowerCase().includes('exercise');
                    return (
                      <tr key={idx}>
                        <td style={{ color: '#f5a623', fontFamily: 'var(--font-mono)', fontSize: '10px', whiteSpace: 'nowrap' }}>
                          {formatDate(tx.startDate)}
                        </td>
                        <td style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>
                          {tx.filerName || 'Unknown'}
                        </td>
                        <td style={{ color: '#888', fontSize: '10px' }}>
                          {tx.filerRelation || tx.ownership || '--'}
                        </td>
                        <td style={{ color: isBuy ? '#00c853' : '#ff3b3b', fontWeight: 'bold', fontSize: '10px' }}>
                          {tx.transactionText || tx.type || '--'}
                        </td>
                        <td style={{ textAlign: 'right', color: '#e0e0e0', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                          {formatNumber(tx.shares)}
                        </td>
                        <td style={{ textAlign: 'right', color: '#00d4ff', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                          {tx.value ? '$' + formatNumber(tx.value) : '--'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Sub-tab: Debt ─── */}
      {subTab === 'debt' && (
        <div style={{ flex: 1, overflow: 'hidden', paddingTop: '8px' }}>
          {loadingBS ? (
            <div style={{ color: '#555', fontSize: '11px', textAlign: 'center', paddingTop: '40px' }}>Loading balance sheet data...</div>
          ) : !balanceSheet ? (
            <div style={{ color: '#555', fontSize: '11px', textAlign: 'center', paddingTop: '40px' }}>No balance sheet data available.</div>
          ) : (
            <div style={{ display: 'flex', gap: '24px' }}>
              <div className="bg-panel" style={{ flex: 1 }}>
                <div style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '8px' }}>
                  <span className="text-amber" style={{ fontWeight: 'bold', fontSize: '10px' }}>BALANCE SHEET HIGHLIGHTS</span>
                </div>
                <table className="data-table" style={{ border: 'none' }}>
                  <tbody>
                    <tr><td style={{ border: 'none', color: 'var(--text-secondary)' }}>Total Debt</td>
                        <td style={{ border: 'none', color: '#ff3b3b' }}>{formatNumber(balanceSheet.totalDebt)}</td></tr>
                    <tr><td style={{ border: 'none', color: 'var(--text-secondary)' }}>Total Cash</td>
                        <td style={{ border: 'none', color: '#00c853' }}>{formatNumber(balanceSheet.totalCash)}</td></tr>
                    <tr><td style={{ border: 'none', color: 'var(--text-secondary)' }}>Net Debt</td>
                        <td style={{ border: 'none', color: (balanceSheet.totalDebt || 0) > (balanceSheet.totalCash || 0) ? '#ff3b3b' : '#00c853' }}>
                          {formatNumber((balanceSheet.totalDebt || 0) - (balanceSheet.totalCash || 0))}
                        </td></tr>
                    <tr><td style={{ border: 'none', color: 'var(--text-secondary)' }}>Debt/Equity</td>
                        <td style={{ border: 'none', color: 'var(--accent-cyan)' }}>{balanceSheet.debtToEquity?.toFixed(2) || '--'}</td></tr>
                    <tr><td style={{ border: 'none', color: 'var(--text-secondary)' }}>Current Ratio</td>
                        <td style={{ border: 'none', color: 'var(--accent-cyan)' }}>{balanceSheet.currentRatio?.toFixed(2) || '--'}</td></tr>
                    <tr><td style={{ border: 'none', color: 'var(--text-secondary)' }}>Quick Ratio</td>
                        <td style={{ border: 'none', color: 'var(--accent-cyan)' }}>{balanceSheet.quickRatio?.toFixed(2) || '--'}</td></tr>
                    <tr><td style={{ border: 'none', color: 'var(--text-secondary)' }}>Total Revenue</td>
                        <td style={{ border: 'none', color: 'var(--text-primary)' }}>{formatNumber(balanceSheet.totalRevenue)}</td></tr>
                    <tr><td style={{ border: 'none', color: 'var(--text-secondary)' }}>EBITDA</td>
                        <td style={{ border: 'none', color: 'var(--text-primary)' }}>{formatNumber(balanceSheet.ebitda)}</td></tr>
                    <tr><td style={{ border: 'none', color: 'var(--text-secondary)' }}>Free Cash Flow</td>
                        <td style={{ border: 'none', color: (balanceSheet.freeCashflow || 0) >= 0 ? '#00c853' : '#ff3b3b' }}>
                          {formatNumber(balanceSheet.freeCashflow)}
                        </td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
