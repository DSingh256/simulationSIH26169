import React from 'react';
import { useSimStore } from '../store/simStore';

export default function PATpipeline() {
  const latencies = useSimStore(s => s.patLatencies);
  
  return (
    <div>
      <div className="panel-title">Pipeline <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>UAV-1</span></div>
      
      <div style={{ marginTop: '10px' }}>
        <div className="pipeline-step">
          <div className="step-num" style={{ background: 'var(--accent-green)' }}>✓</div>
          <div className="step-label">1. Target Detection</div>
          <div className="step-value">{latencies.targetDetection.toFixed(1)} ms</div>
        </div>
        
        <div className="pipeline-step">
          <div className="step-num" style={{ background: 'var(--accent-green)' }}>✓</div>
          <div className="step-label">2. Multi-target Association</div>
          <div className="step-value">{latencies.multiTargetAssoc.toFixed(1)} ms</div>
        </div>
        
        <div className="pipeline-step">
          <div className="step-num" style={{ background: 'var(--accent-green)' }}>✓</div>
          <div className="step-label">3. State Estimation (EKF)</div>
          <div className="step-value">{latencies.stateEstimation.toFixed(1)} ms</div>
        </div>
        
        <div className="pipeline-step">
          <div className="step-num" style={{ background: 'var(--accent-green)' }}>✓</div>
          <div className="step-label">4. Motion Prediction</div>
          <div className="step-value">{latencies.motionPrediction.toFixed(1)} ms</div>
        </div>
        
        <div className="pipeline-step">
          <div className="step-num" style={{ background: 'var(--accent-green)' }}>✓</div>
          <div className="step-label">5. Pointing Control (PID)</div>
          <div className="step-value">{latencies.pointingControl.toFixed(1)} ms</div>
        </div>
        
        <div className="pipeline-step">
          <div className="step-num" style={{ background: 'var(--accent-green)' }}>✓</div>
          <div className="step-label">6. Camera Actuation</div>
          <div className="step-value">{latencies.cameraActuation.toFixed(1)} ms</div>
        </div>

        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 0' }}></div>
        
        <div className="pipeline-step">
          <div className="step-num" style={{ background: 'var(--accent-blue)' }}>7</div>
          <div className="step-label">7. Coarse Alignment</div>
          <div className="step-value" style={{ color: 'var(--accent-blue)' }}>{latencies.coarseAlignment}</div>
        </div>
        
        <div className="pipeline-step">
          <div className="step-num" style={{ background: 'var(--accent-green)' }}>8</div>
          <div className="step-label">8. Fine Alignment Handoff</div>
          <div className="step-value" style={{ color: 'var(--accent-green)' }}>{latencies.fineAlignment}</div>
        </div>
      </div>
    </div>
  );
}
