import React from 'react';
import { useSimStore } from '../store/simStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function TrackingPerformanceChart() {
  const chartData = useSimStore(s => s.trackingHistory);
  const store = useSimStore();
  const link0 = store.links[0] || {};

  return (
    <div className="full-chart-section">
      <div className="chart-header">
        <div>
          <div className="chart-title">{(link0.angularError || 0).toFixed(2)} µRAD OFFSET</div>
          <div className="chart-subtitle">Dual-axis pointing error over time</div>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: '9px', fontFamily: "'JetBrains Mono', monospace" }}>
          <span style={{ color: 'var(--accent-blue)' }}>— Angular</span>
          <span style={{ color: 'var(--text-muted)' }}>-- Predicted</span>
          <span style={{ color: 'var(--accent-red)' }}>-- Boundary</span>
        </div>
      </div>
      
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
            <YAxis scale="log" domain={['auto', 'auto']} stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={false} tickFormatter={v => v.toFixed(1)} />
            <ReferenceLine y={100} stroke="var(--accent-red)" strokeDasharray="3 3" opacity={0.5} />
            <Line type="monotone" dataKey="actual" stroke="var(--accent-blue)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
            <Line type="monotone" dataKey="predicted" stroke="var(--text-muted)" dot={false} strokeWidth={1} strokeDasharray="4 4" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-stats-row">
        <div className="chart-stat">
          <div className="cs-label">RMS Error</div>
          <div className="cs-value">{(link0.angularError || 0).toFixed(2)} µrad</div>
        </div>
        <div className="chart-stat">
          <div className="cs-label">Loop Latency</div>
          <div className="cs-value">{store.patLatencies.pointingControl.toFixed(1)} ms</div>
        </div>
        <div className="chart-stat">
          <div className="cs-label">Link Margin</div>
          <div className="cs-value">+{(link0.linkMargin || 0).toFixed(1)} dB</div>
        </div>
      </div>
    </div>
  );
}
