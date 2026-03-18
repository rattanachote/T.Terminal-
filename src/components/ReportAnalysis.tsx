import React, { useState, useEffect } from 'react';
import { Terminal, FileText, AlertTriangle, Building, Link as LinkIcon } from 'lucide-react';

export default function ReportAnalysis({ ticker, range = '1y' }: { ticker: string, range?: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchAnalysis() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/sec/nlp?ticker=${ticker}&range=${range}`);
        const result = await res.json();
        if (result.error) {
          setError(result.error);
        } else {
          setData(result);
        }
      } catch (e: any) {
        setError(e.message || "Failed to analyze report");
      } finally {
        setLoading(false);
      }
    }
    fetchAnalysis();
  }, [ticker, range]);

  if (loading) {
    return (
      <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--accent-cyan)' }}>
          <Terminal size={18} />
          <span>INITIATING NLP EXTRACTION FOR {ticker}...</span>
        </div>
        <div>[SYSTEM] Fetching SEC EDGAR Archive...</div>
        <div>[SYSTEM] Locating latest 10-K Annual Report...</div>
        <div>[SYSTEM] Extracting Business and Risk Factors via natural language processing...</div>
        <div className="cursor-blink" style={{ marginTop: '16px' }}></div>
      </div>
    );
  }

  if (error) {
    const isETF = error.toLowerCase().includes('10-k') || error.toLowerCase().includes('not found') || error.toLowerCase().includes('cik');
    return (
      <div style={{ flex: 1, padding: '24px', color: isETF ? 'var(--text-muted)' : 'var(--accent-red)' }}>
        <AlertTriangle size={24} style={{ marginBottom: '16px' }} />
        <h3>{isETF ? 'DATA NOT APPLICABLE' : 'NLP ANALYSIS FAILED'}</h3>
        <p>{isETF ? `ETFs and Indices like ${ticker} do not file 10-K Annual Reports. NLP analysis is only available for individual corporations.` : error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
      <header style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
        <h2 className="text-cyan" style={{ fontSize: '20px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={20} />
          {data.companyName} ({data.ticker}) - {data.form} Analysis
        </h2>
        <div style={{ display: 'flex', gap: '24px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span>CIK: {data.cik}</span>
          <span>Filed: {data.filingDate}</span>
          <a href={data.documentUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
            <LinkIcon size={12} /> Source Document
          </a>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {data.performance && (
        <section className="bg-panel" style={{ padding: '20px', display: 'flex', gap: '48px', alignItems: 'center' }}>
            <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>{data.performance.period} Price ACTION</div>
                <div className={data.performance.changePct >= 0 ? 'text-green' : 'text-red'} style={{ fontSize: '32px', fontWeight: 'bold', textShadow: '0 0 10px rgba(0,255,100,0.1)' }}>
                    {data.performance.changePct >= 0 ? '+' : ''}{data.performance.changePct.toFixed(2)}%
                </div>
            </div>
            <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '24px' }}>
                 <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>START PX</div>
                 <div className="text-cyan" style={{ fontSize: '18px' }}>${data.performance.startPrice.toFixed(2)}</div>
            </div>
            <div>
                 <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>END PX</div>
                 <div className="text-cyan" style={{ fontSize: '18px' }}>${data.performance.endPrice.toFixed(2)}</div>
            </div>
        </section>
        )}

        <section className="bg-panel" style={{ padding: '20px' }}>
          <h3 className="text-cyan" style={{ fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <FileText size={16} /> Item 7: Management's Discussion & Analysis
          </h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {data.analysis.managementDiscussion}
          </p>
        </section>
        
        <section className="bg-panel" style={{ padding: '20px' }}>
          <h3 className="text-amber" style={{ fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <Building size={16} /> Item 1: Business Overview
          </h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {data.analysis.businessOverview}
          </p>
        </section>

        <section className="bg-panel" style={{ padding: '20px' }}>
          <h3 className="text-red" style={{ fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <AlertTriangle size={16} /> Item 1A: Risk Factors
          </h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {data.analysis.riskFactors}
          </p>
        </section>

        <section className="bg-panel" style={{ padding: '20px' }}>
          <h3 className="text-muted" style={{ fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <AlertTriangle size={16} /> Item 3: Legal Proceedings
          </h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {data.analysis.legalProceedings}
          </p>
        </section>

      </div>
    </div>
  );
}
