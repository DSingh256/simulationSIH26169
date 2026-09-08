import React, { useState, useEffect } from 'react';
import { useSimStore } from '../store/simStore';

export default function HeaderBar() {
  const simRunning = useSimStore(s => s.simRunning);
  const simPaused = useSimStore(s => s.simPaused);
  
  const [clock, setClock] = useState('');
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setClock(d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + '  ' +
        d.toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const statusColor = simPaused ? 'amber' : simRunning ? 'green' : 'red';

  return (
    <div className="header-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ 
          width: 26, height: 26, borderRadius: '3px', 
          background: 'linear-gradient(135deg, #c87832, #e8943c)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '7px', fontWeight: 700, color: '#0a0a0a', letterSpacing: '0.5px'
        }}>PAT</div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-bright)', letterSpacing: '0.5px' }}>
          VirtuPAT
        </div>
        <div style={{ fontSize: '8px', color: 'var(--text-muted)', marginLeft: 4 }}>
          FSOC Terminal Alignment
        </div>
      </div>

      <div style={{ display: 'flex', gap: '3px' }}>
        <button className="nav-tab active">Telemetry</button>
        <button className="nav-tab">Optical Feeds</button>
        <button className="nav-tab">PAT Config</button>
        <button className="nav-tab">Link Mesh</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
          {clock}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span className={`status-dot ${statusColor} ${simRunning && !simPaused ? 'pulse' : ''}`}></span>
        </div>
      </div>
    </div>
  );
}
