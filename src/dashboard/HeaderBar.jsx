import React, { useState, useEffect } from 'react';
import { useSimStore } from '../store/simStore';

export default function HeaderBar() {
  const simRunning = useSimStore(s => s.simRunning);
  const simPaused = useSimStore(s => s.simPaused);
  const simTime = useSimStore(s => s.simTime);
  const numUAVs = useSimStore(s => s.numUAVs);
  const links = useSimStore(s => s.links);
  
  const [clock, setClock] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setClock(d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + '  ' +
        d.toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const lockedLinks = links.filter(l => l.state === 'LOCKED').length;
  const acquiringLinks = links.filter(l => l.state === 'ACQUIRING').length;
  const lostLinks = links.filter(l => l.state === 'LOST').length;

  const statusText = simPaused ? 'Paused' : simRunning ? 'Simulation Running' : 'Stopped';
  const statusColor = simPaused ? 'amber' : simRunning ? 'green' : 'red';

  return (
    <div className="header-bar">
      {/* Left: Logo + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ 
          width: 32, height: 32, borderRadius: '50%', 
          background: 'linear-gradient(135deg, #ff6b00, #ff9500)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '10px', fontWeight: 700, color: '#fff'
        }}>ISRO</div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-bright)' }}>
            AI-Based Virtual Camera Tracking System
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
            For Coarse Alignment of Mobile FSOC Terminals
          </div>
        </div>
      </div>

      {/* Center: Nav Tabs */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button className="nav-tab active">Simulation</button>
        <button className="nav-tab">Analytics</button>
        <button className="nav-tab">UAV Control</button>
        <button className="nav-tab">Reports</button>
        <button className="nav-tab">Settings</button>
      </div>

      {/* Center-right: Quick Stats */}
      <div style={{ display: 'flex', gap: '16px', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>
        <div><span style={{ color: 'var(--accent-blue)' }}>UAVs: </span>{numUAVs}</div>
        <div><span style={{ color: 'var(--accent-green)' }}>Active Links: </span>{lockedLinks}</div>
        <div><span style={{ color: 'var(--accent-amber)' }}>Acquiring: </span>{acquiringLinks}</div>
        <div><span style={{ color: 'var(--accent-red)' }}>Lost: </span>{lostLinks}</div>
        <div><span style={{ color: 'var(--text-muted)' }}>Sim Time: </span>{simTime.toFixed(1)} s</div>
      </div>

      {/* Right: Clock + Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
          {clock}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
          <span className={`status-dot ${statusColor} ${simRunning && !simPaused ? 'pulse' : ''}`}></span>
          <span style={{ color: `var(--accent-${statusColor})` }}>{statusText}</span>
        </div>
        <div style={{ 
          fontSize: '10px', color: 'var(--text-muted)', 
          fontFamily: "'JetBrains Mono', monospace",
          background: 'var(--bg-input)', padding: '2px 8px', borderRadius: '4px',
          border: '1px solid var(--border-subtle)'
        }}>
          RT x{useSimStore.getState().simSpeed.toFixed(1)}
        </div>
      </div>
    </div>
  );
}
