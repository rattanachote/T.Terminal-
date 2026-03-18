import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS: Record<string, string> = {
  NVDA: '#00e5ff', 
  AMD: '#ff3d00', 
  INTC: '#f5a623',
  AVGO: '#00e676',
  QCOM: '#d500f9',
  TXN: '#2979ff',
  MRVL: '#ffb000',
  ARM: '#e0e0e0'
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '10px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
        <p className="text-muted" style={{ marginBottom: '8px' }}>{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: entry.color, borderRadius: '1px' }}></div>
            <span style={{ color: 'var(--text-secondary)', width: '40px' }}>{entry.name}:</span>
            <span style={{ color: entry.color, fontWeight: 'bold' }}>{entry.value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function FinancialChart({ tickers = ['NVDA', 'AMD', 'INTC', 'AVGO', 'QCOM', 'TXN', 'MRVL', 'ARM'], range = '3mo' }: { tickers?: string[], range?: string }) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChartData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/market/chart?tickers=${tickers.join(',')}&range=${range}`);
        const data = await res.json();
        
        if (data.error) {
            console.error(data.error);
            return;
        }

        // Align the timeseries for all tickers into a single array formatted for recharts
        // We will index by timestamp or date string
        const mappedData: Record<string, any> = {};
        
        for (const ticker of tickers) {
            if (!data[ticker]) continue;
            
            for (const pt of data[ticker]) {
                const dateKey = pt.date.split('T')[0]; // Simplify by date, or use timestamp for intraday
                
                if (!mappedData[dateKey]) {
                    mappedData[dateKey] = { name: dateKey };
                }
                mappedData[dateKey][ticker] = pt.close;
            }
        }
        
        // Sort chronologically
        const sortedArray = Object.values(mappedData).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
        setChartData(sortedArray);
      } catch (err) {
        console.error("Failed to load chart data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchChartData();
  }, [tickers, range]);

  if (loading) {
     return <div style={{ fontSize: '12px', opacity: 0.5 }}>Loading Market Data...</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
          <XAxis 
            dataKey="name" 
            stroke="var(--text-muted)" 
            fontSize={10} 
            tick={{fill: 'var(--text-muted)'}}
            tickLine={false}
            tickFormatter={(val) => {
                // Shorten date string "2024-05-15" to "May 15"
                const d = new Date(val);
                if(isNaN(d.getTime())) return val;
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
          />
          <YAxis 
            domain={['auto', 'auto']}
            stroke="var(--text-muted)" 
            fontSize={10} 
            tick={{fill: 'var(--text-muted)'}}
            tickLine={false}
            axisLine={false}
            orientation="right"
          />
          <Tooltip content={<CustomTooltip />} />
          {tickers.map((ticker, idx) => (
            <Line 
              key={ticker}
              type="monotone" 
              dataKey={ticker} 
              stroke={Object.values(COLORS)[idx % Object.values(COLORS).length]} 
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
