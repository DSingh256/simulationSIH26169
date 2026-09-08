import React from 'react';
import { useSimStore } from '../store/simStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function TrackingPerformanceChart() {
  const chartData = useSimStore(s => s.trackingHistory);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Tracking Performance <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>(Live Camera)</span></span>
        <div style={{ display: 'flex', gap: 12, fontSize: '9px', fontWeight: 'normal', fontFamily: "'JetBrains Mono', monospace" }}>
          <span style={{ color: 'var(--accent-blue)' }}>— Angular Error (μrad)</span>
          <span style={{ color: 'var(--text-muted)' }}>-- Predicted Error (μrad)</span>
          <span style={{ color: 'var(--accent-red)' }}>-- FOV Boundary</span>
        </div>
      </div>
      
      <div style={{ flex: 1, minHeight: 0, marginTop: 10 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={{ stroke: 'var(--border-subtle)' }} />
            <YAxis scale="log" domain={['auto', 'auto']} stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={false} tickFormatter={v => v.toFixed(1)} />
            
            <ReferenceLine y={100} stroke="var(--accent-red)" strokeDasharray="3 3" opacity={0.5} />
            
            <Line type="monotone" dataKey="actual" stroke="var(--accent-blue)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
            <Line type="monotone" dataKey="predicted" stroke="var(--text-muted)" dot={false} strokeWidth={1} strokeDasharray="4 4" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
