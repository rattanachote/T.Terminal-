'use client';
import React from 'react';

interface TopHeaderProps {
  ticker: string;
  price: number;
  changePct: number;
  volume: string;
  marketCap: string;
  marketStatus: 'OPEN' | 'CLOSED';
  // Extended fields
  open?: number;
  high?: number;
  low?: number;
  wk52High?: number;
  wk52Low?: number;
  prevClose?: number;
}

export default function TopHeader({ 
  ticker, price, changePct, volume, marketCap, marketStatus, 
  open, high, low, wk52High, wk52Low, prevClose 
}: TopHeaderProps) {
  const isPositive = changePct >= 0;
  const change = prevClose ? (price - prevClose) : (price * changePct / 100);
  const fmt = (v?: number) => v != null ? v.toFixed(2) : '--';

  return (
    <div style={{
      backgroundColor: '#5a0000',
      borderBottom: '2px solid #8e0000',
      padding: '4px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 'var(--font-size-base)',
      fontFamily: 'var(--font-mono)',
      color: '#ffffff',
      minHeight: '36px',
    }}>
      {/* Left: Branding */}
      <div style={{ 
        fontSize: 'var(--font-size-xs)', 
        color: '#ff9999', 
        fontWeight: 'bold', 
        letterSpacing: '1px',
        whiteSpace: 'nowrap',
        marginRight: '16px',
      }}>
        T TERMINAL
      </div>

      {/* Center-Left: Ticker + Price Block */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        {/* Ticker name */}
        <span style={{ fontWeight: 'bold', fontSize: 'var(--font-size-base)', marginRight: '4px' }}>
          {ticker} US Equity
        </span>

        {/* Vertical Separator */}
        <span style={{ color: '#8e0000', fontSize: '14px' }}>|</span>

        {/* Price */}
        <span style={{ fontWeight: 'bold', fontSize: 'var(--font-size-lg)', color: '#fff' }}>
          ${fmt(price)}
        </span>

        {/* Change */}
        <span style={{ 
          color: isPositive ? '#00e676' : '#ff3b3b', 
          fontWeight: 'bold', 
          fontSize: 'var(--font-size-sm)' 
        }}>
          {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
        </span>

        {/* Sparkline arrow */}
        <span style={{ color: isPositive ? '#00e676' : '#ff3b3b', fontSize: '12px' }}>
          {isPositive ? '↑' : '↓'}
        </span>

        {/* Additional Data Points */}
        <div style={{ display: 'flex', gap: '12px', marginLeft: '16px', color: '#ffaaaa', fontSize: 'var(--font-size-xs)' }}>
          {open != null && <span>O:{fmt(open)}</span>}
          {high != null && <span>H:{fmt(high)}</span>}
          {low != null && <span>L:{fmt(low)}</span>}
          <span>Vol:{volume}</span>
          <span>MktCap:{marketCap}</span>
        </div>
      </div>

      {/* Right: Status */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', whiteSpace: 'nowrap' }}>
        {wk52High != null && wk52Low != null && (
          <span style={{ fontSize: '9px', color: '#cc8888' }}>
            52W: {fmt(wk52Low)} – {fmt(wk52High)}
          </span>
        )}
        <span style={{ color: '#ffaaaa', fontSize: 'var(--font-size-xs)' }}>Financial Analytics Platform</span>
        <span style={{ fontSize: '10px', color: '#aaa' }}>•</span>
        <div className="badge badge-live" style={{ 
          backgroundColor: marketStatus === 'OPEN' ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 61, 0, 0.2)',
          color: marketStatus === 'OPEN' ? 'var(--accent-green)' : 'var(--accent-red)',
          borderColor: marketStatus === 'OPEN' ? 'var(--accent-green)' : 'var(--accent-red)'
        }}>
          {marketStatus}
        </div>
      </div>
    </div>
  );
}
