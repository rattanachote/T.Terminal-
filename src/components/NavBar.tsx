'use client';
import React from 'react';

interface NavBarProps {
  activeTab: number;
  setActiveTab: (index: number) => void;
  ticker: string;
}

export const TABS = [
  "[0] HOME",
  "[1] OVERVIEW",
  "[2] ANALYSIS",
  "[3] REL INDEX",
  "[4] REL VALUE",
  "[5] NEWS",
  "[6] OWNERSHIP"
];

const TAB_CONTEXTS: Record<number, string> = {
  0: 'Market Dashboard',
  1: 'Company Overview',
  2: 'NLP Analysis',
  3: 'Relative Index',
  4: 'Relative Value',
  5: 'Company News',
  6: 'Security Ownership',
};

export default function NavBar({ activeTab, setActiveTab, ticker }: NavBarProps) {
  return (
    <div style={{
      backgroundColor: '#001b4a',
      borderBottom: '1px solid #003388',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      fontSize: 'var(--font-size-sm)',
      fontFamily: 'var(--font-mono)',
    }}>
      {/* Left: Ticker badge */}
      <div style={{ 
        padding: '6px 16px', 
        backgroundColor: '#002266', 
        color: 'var(--accent-cyan)', 
        fontWeight: 'bold',
        borderRight: '1px solid #003388',
        whiteSpace: 'nowrap',
      }}>
        {ticker} US Equity
      </div>
      
      {/* Center: Tabs */}
      <div style={{ display: 'flex', flex: 1 }}>
        {TABS.map((tab, index) => {
          const isActive = activeTab === index;
          return (
            <div 
              key={index}
              onClick={() => setActiveTab(index)}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                color: isActive ? '#000000' : '#88aaff',
                backgroundColor: isActive ? 'var(--accent-amber)' : 'transparent',
                borderRight: '1px solid #003388',
                fontWeight: isActive ? 'bold' : 'normal',
                transition: 'all 0.1s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = '#002a6a'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {tab}
            </div>
          );
        })}
      </div>

      {/* Right: Context + Hint */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <span style={{ color: '#aabbee', fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}>
          {ticker} US Equity | {TAB_CONTEXTS[activeTab] || ''}
        </span>
        <span style={{ color: '#5577cc', fontSize: '9px', whiteSpace: 'nowrap' }}>
          Press 0-6 to navigate • Type ticker to search
        </span>
      </div>
    </div>
  );
}
