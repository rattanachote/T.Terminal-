"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';
import ReportAnalysis from '@/components/ReportAnalysis';
import TopHeader from '@/components/TopHeader';
import NavBar from '@/components/NavBar';
import HomeTab from '@/components/HomeTab';
import OverviewTab from '@/components/OverviewTab';
import NewsTab from '@/components/NewsTab';
import OwnershipTab from '@/components/OwnershipTab';
import RelValueTab from '@/components/RelValueTab';
import RelIndexTab from '@/components/RelIndexTab';

export default function TerminalDashboard() {
  const [cmd, setCmd] = useState('');
  const [timeStr, setTimeStr] = useState<string>('');
  const fmtN = (v: number | null | undefined) => {
    if (v == null) return '--';
    if (v >= 1e12) return (v / 1e12).toFixed(2) + 'T';
    if (v >= 1e9)  return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6)  return (v / 1e6).toFixed(2) + 'M';
    return v.toLocaleString();
  };
  
  // App Shell State
  const [activeTab, setActiveTab] = useState(0);
  const [activeTicker, setActiveTicker] = useState('NVDA');
  const [headerData, setHeaderData] = useState<any>(null);

  // 1. Clock
  useEffect(() => {
    setTimeStr(new Date().toISOString().split('T')[1].substring(0, 8) + ' UTC');
    const interval = setInterval(() => {
      setTimeStr(new Date().toISOString().split('T')[1].substring(0, 8) + ' UTC');
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Fetch Header Data for Active Ticker
  useEffect(() => {
    async function fetchHeader() {
      try {
        const res = await fetch(`/api/market/quotes?tickers=${activeTicker}`);
        const data = await res.json();
        if (data && data.length > 0) {
           setHeaderData(data[0]);
        }
      } catch (e) {
        console.error("Failed to fetch header quotes", e);
      }
    }
    fetchHeader();
  }, [activeTicker]);

  // 3. Navigate to a ticker + tab from HomeTab
  const handleSelectTicker = useCallback((ticker: string) => {
    setActiveTicker(ticker.toUpperCase());
    setActiveTab(1); // go to OVERVIEW
  }, []);

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = cmd.trim().toUpperCase();
    if (!trimmed) return;
    
    // Tab navigation commands
    if (trimmed === 'HOME' || trimmed === '0') { setActiveTab(0); }
    else if (trimmed === '1') { setActiveTab(1); }
    else if (trimmed === '2') { setActiveTab(2); }
    else if (trimmed === '3') { setActiveTab(3); }
    else if (trimmed === '4') { setActiveTab(4); }
    else if (trimmed === '5') { setActiveTab(5); }
    else if (trimmed === '6') { setActiveTab(6); }
    else if (trimmed.startsWith('NLP ')) {
       setActiveTicker(trimmed.replace('NLP ', '').trim());
       setActiveTab(2);
    } else if (!trimmed.includes(' ')) {
       // Any ticker — no length limit
       setActiveTicker(trimmed);
       setActiveTab(1);
    }
    
    setCmd('');
  };

  return (
    <div className="terminal-layout">
      
      {/* 1. Global Red Header */}
      {headerData ? (
        <TopHeader 
          ticker={activeTicker}
          price={headerData.lastPx || 0}
          changePct={headerData.chg1D || 0}
          volume={fmtN(headerData.volume)}
          marketCap={fmtN(headerData.mktCap)}
          marketStatus="OPEN"
          open={headerData.open}
          high={headerData.high}
          low={headerData.low}
          wk52High={headerData.wk52High}
          wk52Low={headerData.wk52Low}
          prevClose={headerData.prevClose}
        />
      ) : (
        <div style={{ height: '40px', backgroundColor: '#5a0000', borderBottom: '2px solid #8e0000', display: 'flex', alignItems: 'center', padding: '0 16px', color: '#ffaaaa' }}>
          Loading {activeTicker}...
        </div>
      )}

      {/* 2. Global Blue Navigation Bar */}
      <NavBar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        ticker={activeTicker} 
      />

      {/* 3. Command Bar (Utility) */}
      <div style={{ display: 'flex', padding: 'var(--spacing-sm) var(--spacing-md)', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
        <div className="terminal-input-wrapper" style={{ flex: '0 1 400px', padding: '4px 8px' }}>
            <span className="terminal-input-prefix" style={{ fontSize: '10px' }}>CMD&gt;</span>
            <form onSubmit={handleCommandSubmit} style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
              <input 
                type="text" 
                className="terminal-input"
                style={{ fontSize: '12px', padding: 0 }}
                value={cmd}
                onChange={(e) => setCmd(e.target.value)}
                placeholder="Type ticker or command..."
                autoFocus
              />
            </form>
            <div className="cursor-blink" style={{ height: '10px', width: '5px' }}></div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={12} />
            <span style={{ fontSize: '10px' }}>{timeStr || 'Loading...'}</span>
          </div>
        </div>
      </div>

      {/* 4. Main Tab Content Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '16px' }}>
        
        {activeTab === 0 && (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <HomeTab onSelectTicker={handleSelectTicker} />
          </div>
        )}

        {activeTab === 1 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <OverviewTab ticker={activeTicker} />
          </div>
        )}

        {activeTab === 2 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            <ReportAnalysis ticker={activeTicker} range="1y" />
          </div>
        )}

        {activeTab === 3 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <RelIndexTab ticker={activeTicker} />
          </div>
        )}

        {activeTab === 4 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <RelValueTab ticker={activeTicker} />
          </div>
        )}

        {activeTab === 5 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <NewsTab ticker={activeTicker} />
          </div>
        )}

        {activeTab === 6 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <OwnershipTab ticker={activeTicker} />
          </div>
        )}

        {activeTab !== 0 && activeTab !== 1 && activeTab !== 2 && activeTab !== 3 && activeTab !== 4 && activeTab !== 5 && activeTab !== 6 && (
          <div style={{ color: 'var(--text-muted)' }}>
            MODULE [{activeTab}] UNDER CONSTRUCTION. Preparing {activeTicker} analytics...
          </div>
        )}

      </div>
    </div>
  );
}
