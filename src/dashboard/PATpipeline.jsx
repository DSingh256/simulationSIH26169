import React from 'react';
import { useSimStore } from '../store/simStore';

export default function PATpipeline() {
  const latencies = useSimStore(s => s.patLatencies);
  
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div className="pipeline-step">
          <div className="step-num" style={{ background: 'var(--accent-green)' }}>✓</div>
          <div className="step-label">Target Detection</div>
          <div className="step-value">{latencies.targetDetection.toFixed(1)} ms</div>
        </div>
        <div className="pipeline-step">
          <div className="step-num" style={{ background: 'var(--accent-green)' }}>✓</div>
          <div className="step-label">Multi-target Association</div>
          <div className="step-value">{latencies.multiTargetAssoc.toFixed(1)} ms</div>
        </div>
        <div className="pipeline-step">
          <div className="step-num" style={{ background: 'var(--accent-green)' }}>✓</div>
          <div className="step-label">State Estimation (EKF)</div>
          <div className="step-value">{latencies.stateEstimation.toFixed(1)} ms</div>
        </div>
        <div className="pipeline-step">
          <div className="step-num" style={{ background: 'var(--accent-green)' }}>✓</div>
          <div className="step-label">Motion Prediction</div>
          <div className="step-value">{latencies.motionPrediction.toFixed(1)} ms</div>
        </div>
        <div className="pipeline-step">
          <div className="step-num" style={{ background: 'var(--accent-green)' }}>✓</div>
          <div className="step-label">Pointing Control (PID)</div>
          <div className="step-value">{latencies.pointingControl.toFixed(1)} ms</div>
        </div>
        <div className="pipeline-step">
          <div className="step-num" style={{ background: 'var(--accent-green)' }}>✓</div>
          <div className="step-label">Camera Actuation</div>
          <div className="step-value">{latencies.cameraActuation.toFixed(1)} ms</div>
        </div>
        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }}></div>
        <div className="pipeline-step">
          <div className="step-num" style={{ background: 'var(--accent-blue)' }}>7</div>
          <div className="step-label">Coarse Alignment</div>
          <div className="step-value" style={{ color: 'var(--accent-blue)' }}>{latencies.coarseAlignment}</div>
        </div>
        <div className="pipeline-step">
          <div className="step-num" style={{ background: 'var(--accent-orange)' }}>8</div>
          <div className="step-label">Fine Alignment</div>
          <div className="step-value" style={{ color: 'var(--accent-orange)' }}>{latencies.fineAlignment}</div>
        </div>
      </div>
    </div>
  );
}
