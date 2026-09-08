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

  const statusText = simPaused ? 'PAUSED' : simRunning ? 'ACTIVE' : 'IDLE';
  const statusColor = simPaused ? 'amber' : simRunning ? 'green' : 'red';

  return (
    <div className="header-bar">
      {/* Left: Logo + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ 
          width: 28, height: 28, borderRadius: '3px', 
          background: 'linear-gradient(135deg, #c87832, #e8943c)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '8px', fontWeight: 700, color: '#0a0a0a', letterSpacing: '0.5px'
        }}>PAT</div>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-bright)', letterSpacing: '0.3px' }}>
            VirtuPAT
          </div>
          <div style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.4px' }}>
            FSOC Terminal Alignment
          </div>
        </div>
      </div>

      {/* Center: Nav Tabs */}
      <div style={{ display: 'flex', gap: '3px' }}>
        <button className="nav-tab active">Simulation</button>
        <button className="nav-tab">Telemetry</button>
        <button className="nav-tab">Network</button>
        <button className="nav-tab">Config</button>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'flex', gap: '14px', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace" }}>
        <div><span style={{ color: 'var(--text-muted)' }}>UAV </span><span style={{ color: 'var(--accent-orange)' }}>{numUAVs}</span></div>
        <div><span style={{ color: 'var(--text-muted)' }}>LCK </span><span style={{ color: 'var(--accent-green)' }}>{lockedLinks}</span></div>
        <div><span style={{ color: 'var(--text-muted)' }}>ACQ </span><span style={{ color: 'var(--accent-amber)' }}>{acquiringLinks}</span></div>
        <div><span style={{ color: 'var(--text-muted)' }}>LST </span><span style={{ color: 'var(--accent-red)' }}>{lostLinks}</span></div>
        <div><span style={{ color: 'var(--text-muted)' }}>T+ </span>{simTime.toFixed(1)}s</div>
      </div>

      {/* Right: Clock + Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
          {clock}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px' }}>
          <span className={`status-dot ${statusColor} ${simRunning && !simPaused ? 'pulse' : ''}`}></span>
          <span style={{ color: `var(--accent-${statusColor})`, fontSize: '9px', letterSpacing: '0.5px' }}>{statusText}</span>
        </div>
        <div style={{ 
          fontSize: '9px', color: 'var(--text-muted)', 
          fontFamily: "'JetBrains Mono', monospace",
          background: 'var(--bg-input)', padding: '2px 6px', borderRadius: '2px',
          border: '1px solid var(--border)'
        }}>
          {useSimStore.getState().simSpeed.toFixed(1)}x
        </div>
      </div>
    </div>
  );
}
