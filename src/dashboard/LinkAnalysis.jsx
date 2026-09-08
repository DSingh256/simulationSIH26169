import React from 'react';
import { useSimStore } from '../store/simStore';

export default function LinkAnalysis() {
  const store = useSimStore();
  const link = store.links[store.selectedLink] || store.links[0] || {};
  
  return (
    <div>
      <div className="col-section-label">
        <span>Link UAV-{link.from + 1} ↔ UAV-{link.to + 1}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
          <span className="label">Confidence</span>
          <span className="value">{((link.confidence || 0) * 100).toFixed(1)} %</span>
        </div>
        <div className="data-row">
          <span className="label">Rel. Velocity</span>
          <span className="value">{(Math.random() * 5 + 15).toFixed(1)} m/s</span>
        </div>
        <div className="data-row">
          <span className="label">Rx Power</span>
          <span className="value">{(link.receivedPower || -30).toFixed(1)} dBm</span>
        </div>
        <div className="data-row">
          <span className="label">Link Margin</span>
          <span className="value">{(link.linkMargin || 0).toFixed(1)} dB</span>
        </div>
        <div className="data-row">
          <span className="label">Link State</span>
          <span>{link.state === 'LOCKED' && <span className="status-badge locked">LOCKED</span>}
          {link.state === 'ACQUIRING' && <span className="status-badge acquiring">ACQUIRING</span>}
          {link.state === 'LOST' && <span className="status-badge searching">LOST</span>}</span>
        </div>
      </div>
    </div>
  );
}
