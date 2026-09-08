import React from 'react';
import { useSimStore } from '../store/simStore';

export default function SystemPerformance() {
  const perf = useSimStore(s => s.sysPerf);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="data-row">
        <span className="label">FPS</span>
        <span className="value" style={{ color: 'var(--accent-green)' }}>{perf.fps}</span>
      </div>
      <div className="data-row">
        <span className="label">Acq. Time (avg)</span>
        <span className="value">{perf.acqTime} s</span>
      </div>
      <div className="data-row">
        <span className="label">Reacq. Time (avg)</span>
        <span className="value">{perf.reacqTime} s</span>
      </div>
      <div className="data-row">
        <span className="label">Avg Track Error</span>
        <span className="value">{perf.avgTrackError} µrad</span>
      </div>
      <div className="data-row">
        <span className="label">Max Track Error</span>
        <span className="value" style={{ color: 'var(--accent-amber)' }}>{perf.maxTrackError} µrad</span>
      </div>
      <div className="data-row">
        <span className="label">Lock Retention</span>
        <span className="value">{perf.lockRetention} %</span>
      </div>
      <div className="data-row">
        <span className="label">False Detection</span>
        <span className="value">{perf.falseDetection} %</span>
      </div>
      <div className="data-row">
        <span className="label">Inference Time</span>
        <span className="value">{perf.inferenceTime} ms</span>
      </div>
    </div>
  );
}
