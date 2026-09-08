import React from 'react';
import { useSimStore } from '../store/simStore';

export default function SystemPerformance() {
  const perf = useSimStore(s => s.sysPerf);
  
  return (
    <div>
      <div className="panel-title">Performance</div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        <div className="data-row">
          <span className="label">FPS</span>
          <span className="value" style={{ color: 'var(--accent-green)' }}>{perf.fps}</span>
        </div>
        <div className="data-row">
          <span className="label">Acquisition Time (avg)</span>
          <span className="value" style={{ color: 'var(--accent-green)' }}>{perf.acqTime} s</span>
        </div>
        <div className="data-row">
          <span className="label">Reacquisition Time (avg)</span>
          <span className="value" style={{ color: 'var(--accent-green)' }}>{perf.reacqTime} s</span>
        </div>
        <div className="data-row">
          <span className="label">Avg Tracking Error</span>
          <span className="value" style={{ color: 'var(--accent-green)' }}>{perf.avgTrackError} µrad</span>
        </div>
        <div className="data-row">
          <span className="label">Max Tracking Error</span>
          <span className="value" style={{ color: 'var(--accent-amber)' }}>{perf.maxTrackError} µrad</span>
        </div>
        <div className="data-row">
          <span className="label">Lock Retention Rate</span>
          <span className="value" style={{ color: 'var(--accent-green)' }}>{perf.lockRetention} %</span>
        </div>
        <div className="data-row">
          <span className="label">False Detection Rate</span>
          <span className="value" style={{ color: 'var(--accent-green)' }}>{perf.falseDetection} %</span>
        </div>
        <div className="data-row">
          <span className="label">Inference Time</span>
          <span className="value">{perf.inferenceTime} ms</span>
        </div>
        <div className="data-row">
          <span className="label">Control Loop Time</span>
          <span className="value">{perf.controlLoop} ms</span>
        </div>
      </div>
    </div>
  );
}
