import React from 'react';
import { useSimStore } from '../store/simStore';

export default function LinkAnalysis() {
  const store = useSimStore();
  // Safe fallback if selectedLink is invalid
  const link = store.links[store.selectedLink] || store.links[0] || {};
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-title">Link Analysis <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>(UAV-{link.from + 1} ↔ UAV-{link.to + 1})</span></div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        <div className="data-row">
          <span className="label">Distance</span>
          <span className="value">{(link.distance || 0).toFixed(2)} km</span>
        </div>
        <div className="data-row">
          <span className="label">LOS</span>
          {link.losClear ? (
            <span className="value" style={{ color: 'var(--accent-green)' }}>✓ Clear</span>
          ) : (
            <span className="value" style={{ color: 'var(--accent-red)' }}>✗ Blocked</span>
          )}
        </div>
        <div className="data-row">
          <span className="label">Angular Error</span>
          <span className="value">{(link.angularError || 0).toFixed(2)} µrad</span>
        </div>
        <div className="data-row">
          <span className="label">Predicted Error</span>
          <span className="value">{(link.predictedError || 0).toFixed(2)} µrad</span>
        </div>
        <div className="data-row">
          <span className="label">Tracking Confidence</span>
          <span className="value">{((link.confidence || 0) * 100).toFixed(1)} %</span>
        </div>
        <div className="data-row">
          <span className="label">Relative Velocity</span>
          <span className="value">{(Math.random() * 5 + 15).toFixed(1)} m/s</span>
        </div>
        <div className="data-row">
          <span className="label">Received Power</span>
          <span className="value">{(link.receivedPower || -30).toFixed(1)} dBm</span>
        </div>
        <div className="data-row">
          <span className="label">Link Margin</span>
          <span className="value">{(link.linkMargin || 0).toFixed(1)} dB</span>
        </div>
        <div className="data-row">
          <span className="label">Link State</span>
          {link.state === 'LOCKED' && <span className="status-badge locked" style={{ padding: '2px 12px' }}>● LOCKED</span>}
          {link.state === 'ACQUIRING' && <span className="status-badge acquiring" style={{ padding: '2px 12px' }}>● ACQUIRING</span>}
          {link.state === 'LOST' && <span className="status-badge searching" style={{ padding: '2px 12px' }}>● LOST</span>}
        </div>
      </div>

      <div style={{ 
        marginTop: 'auto', 
        border: '1px solid var(--accent-green-dim)', 
        background: 'rgba(0, 255, 136, 0.05)',
        borderRadius: 'var(--radius-sm)',
        padding: '6px',
        textAlign: 'center',
        color: 'var(--accent-green)'
      }}>
        <div style={{ fontSize: '10px', fontWeight: 600 }}>Coarse Alignment Complete</div>
        <div style={{ fontSize: '9px', opacity: 0.8 }}>Fine Alignment Handoff Ready</div>
      </div>
    </div>
  );
}
