import React, { useState, useEffect, useRef } from 'react';
import { useSimStore } from '../store/simStore';
import { AlphaBetaTracker, TrackerState, resolvePerception, FusionDecision } from '../sim/alphaBetaTracker';

// Singleton tracker instance per component lifecycle
const trackerRef = { current: null };

function getOrCreateTracker() {
  if (!trackerRef.current) {
    trackerRef.current = new AlphaBetaTracker({
      alpha: 0.85,
      beta: 0.005,
      gateRadius: 60,
      acquireThreshold: 5,
      coastMaxFrames: 30,
    });
  }
  return trackerRef.current;
}

// ─── Simulate dual-detector outputs from existing store data ───
function simulateDetectors(store) {
  const uav0 = store.uavs[0];
  if (!uav0) return { classical: null, ai: null };

  const link0 = store.links[0];
  const isLocked = link0 && link0.state === 'LOCKED';
  const isLost = link0 && link0.state === 'LOST';
  const noise = store.envProfile?.noiseBase ?? 0.1;
  const turbulence = store.envProfile?.turbulenceBase ?? 0.1;

  const baseCx = 320 + store.pointingError.x * 640;
  const baseCy = 240 + store.pointingError.y * 480;

  // Classical detector — always runs, affected by noise/turbulence
  const classicalNoise = (turbulence + noise) * 15;
  const classical = isLost ? null : {
    x: baseCx + (Math.sin(store.simTime * 3.7) * classicalNoise),
    y: baseCy + (Math.cos(store.simTime * 2.9) * classicalNoise),
    confidence: isLocked ? 0.85 + (1 - noise) * 0.12 : 0.4 + Math.sin(store.simTime) * 0.2,
  };

  // AI detector — lower frame rate, sometimes misses, but more precise when it hits
  const aiActive = Math.sin(store.simTime * 1.3) > -0.6; // ~80% duty cycle
  const aiNoise = noise * 5;
  const ai = (!isLost && aiActive) ? {
    x: baseCx + (Math.sin(store.simTime * 3.7 + 0.1) * aiNoise),
    y: baseCy + (Math.cos(store.simTime * 2.9 + 0.1) * aiNoise),
    confidence: isLocked ? 0.75 + (1 - noise) * 0.2 : 0.3 + Math.sin(store.simTime * 0.7) * 0.15,
  } : null;

  return { classical, ai };
}

// ─── Decision badge colors ───
const DECISION_STYLES = {
  [FusionDecision.AGREE_ACCEPT]: { color: '#4ca854', bg: 'rgba(76,168,84,0.12)', border: 'rgba(76,168,84,0.3)', label: 'AGREE · ACCEPT' },
  [FusionDecision.CLASSICAL_ONLY]: { color: '#5a8ab4', bg: 'rgba(90,138,180,0.12)', border: 'rgba(90,138,180,0.3)', label: 'CLASSICAL ONLY' },
  [FusionDecision.AI_ONLY_REJECT]: { color: '#c43a3a', bg: 'rgba(196,58,58,0.12)', border: 'rgba(196,58,58,0.3)', label: 'AI ONLY · REJECT' },
  [FusionDecision.DISAGREE_REJECT]: { color: '#c87832', bg: 'rgba(200,120,50,0.12)', border: 'rgba(200,120,50,0.3)', label: 'DISAGREE · REJECT' },
  [FusionDecision.NO_DETECTION]: { color: '#4a4844', bg: 'rgba(74,72,68,0.12)', border: 'rgba(74,72,68,0.3)', label: 'NO DETECTION' },
};

const TRACKER_STATE_STYLES = {
  [TrackerState.UNINITIALIZED]: { color: '#4a4844', label: 'UNINIT' },
  [TrackerState.ACQUIRING]: { color: '#c89832', label: 'ACQUIRING' },
  [TrackerState.CONFIRMED]: { color: '#4ca854', label: 'CONFIRMED' },
  [TrackerState.COASTING]: { color: '#8a7aaa', label: 'COASTING' },
  [TrackerState.LOST]: { color: '#c43a3a', label: 'LOST' },
};

export default function HybridFusionPanel() {
  const store = useSimStore();
  const [fusionState, setFusionState] = useState({
    decision: FusionDecision.NO_DETECTION,
    centroid: null,
    confidence: 0,
    agreementDistance: null,
  });
  const [trackerSnap, setTrackerSnap] = useState(null);
  const [detectors, setDetectors] = useState({ classical: null, ai: null });
  const frameRef = useRef(0);

  useEffect(() => {
    if (!store.simRunning || store.simPaused) return;

    const interval = setInterval(() => {
      frameRef.current++;

      const det = simulateDetectors(store);
      setDetectors(det);

      // Run fusion
      const fusion = resolvePerception(det.classical, det.ai);
      setFusionState(fusion);

      // Run alpha-beta tracker
      const tracker = getOrCreateTracker();
      const measX = fusion.centroid ? fusion.centroid.x : null;
      const measY = fusion.centroid ? fusion.centroid.y : null;
      tracker.update(measX, measY);
      setTrackerSnap(tracker.getSnapshot());
    }, 66); // ~15 Hz

    return () => clearInterval(interval);
  }, [store.simRunning, store.simPaused, store.simTime]);

  const ds = DECISION_STYLES[fusionState.decision] || DECISION_STYLES[FusionDecision.NO_DETECTION];
  const ts = trackerSnap ? (TRACKER_STATE_STYLES[trackerSnap.state] || TRACKER_STATE_STYLES[TrackerState.UNINITIALIZED]) : TRACKER_STATE_STYLES[TrackerState.UNINITIALIZED];

  // Agreement meter: 0 = perfect agreement, gateRadius = max
  const gateRadius = trackerSnap?.gateRadius ?? 60;
  const agreeDistNorm = fusionState.agreementDistance !== null
    ? Math.min(1, fusionState.agreementDistance / gateRadius)
    : 0;

  return (
    <div className="hybrid-fusion-panel">
      {/* ── Header ── */}
      <div className="hfp-header">
        <div className="hfp-title">Hybrid Perception Fusion</div>
        <div className="hfp-subtitle">Safe decision table · Classical + AI</div>
      </div>

      {/* ── Decision Badge ── */}
      <div className="hfp-decision-row">
        <div className="hfp-decision-badge" style={{
          background: ds.bg,
          borderColor: ds.border,
          color: ds.color,
        }}>
          <span className="hfp-decision-dot" style={{ background: ds.color }} />
          {ds.label}
        </div>
        <div className="hfp-confidence-pill" style={{
          color: fusionState.confidence > 0.7 ? 'var(--accent-green)' : fusionState.confidence > 0.3 ? 'var(--accent-amber)' : 'var(--accent-red)',
        }}>
          {(fusionState.confidence * 100).toFixed(0)}%
        </div>
      </div>

      {/* ── Dual Detector Bars ── */}
      <div className="hfp-detectors">
        <DetectorBar
          label="CLASSICAL"
          detection={detectors.classical}
          color="var(--accent-blue)"
          active={!!detectors.classical}
        />
        <DetectorBar
          label="AI (CNN)"
          detection={detectors.ai}
          color="var(--accent-purple)"
          active={!!detectors.ai}
        />
      </div>

      {/* ── Agreement Meter ── */}
      <div className="hfp-agree-section">
        <div className="hfp-agree-label">
          <span>Agreement Distance</span>
          <span className="mono" style={{ color: ds.color }}>
            {fusionState.agreementDistance !== null ? `${fusionState.agreementDistance.toFixed(1)} px` : '—'}
          </span>
        </div>
        <div className="hfp-agree-bar-track">
          <div
            className="hfp-agree-bar-fill"
            style={{
              width: `${(1 - agreeDistNorm) * 100}%`,
              background: agreeDistNorm < 0.3 ? 'var(--accent-green)' : agreeDistNorm < 0.7 ? 'var(--accent-amber)' : 'var(--accent-red)',
            }}
          />
          <div className="hfp-agree-threshold" style={{ left: `${(8 / gateRadius) * 100}%` }} title="8px threshold" />
        </div>
      </div>

      {/* ── Tracker State ── */}
      <div className="hfp-tracker-section">
        <div className="hfp-tracker-header">
          <span>α-β State Estimator</span>
          <span className="hfp-tracker-state" style={{ color: ts.color }}>
            {ts.label}
          </span>
        </div>
        {trackerSnap && (
          <div className="hfp-tracker-grid">
            <div className="hfp-tg-item">
              <span className="hfp-tg-label">Position</span>
              <span className="hfp-tg-value">{trackerSnap.x.toFixed(1)}, {trackerSnap.y.toFixed(1)}</span>
            </div>
            <div className="hfp-tg-item">
              <span className="hfp-tg-label">Velocity</span>
              <span className="hfp-tg-value">{trackerSnap.vx.toFixed(2)}, {trackerSnap.vy.toFixed(2)}</span>
            </div>
            <div className="hfp-tg-item">
              <span className="hfp-tg-label">Residual</span>
              <span className="hfp-tg-value">{trackerSnap.residualX.toFixed(1)}, {trackerSnap.residualY.toFixed(1)}</span>
            </div>
            <div className="hfp-tg-item">
              <span className="hfp-tg-label">Track Age</span>
              <span className="hfp-tg-value">{trackerSnap.trackAge} frames</span>
            </div>
            <div className="hfp-tg-item">
              <span className="hfp-tg-label">Coast</span>
              <span className="hfp-tg-value" style={{
                color: trackerSnap.coastFrames > 10 ? 'var(--accent-red)' : 'var(--text-primary)'
              }}>{trackerSnap.coastFrames} / {trackerSnap.acquireThreshold}</span>
            </div>
            <div className="hfp-tg-item">
              <span className="hfp-tg-label">Gate</span>
              <span className="hfp-tg-value" style={{
                color: trackerSnap.gatedOut ? 'var(--accent-red)' : 'var(--accent-green)'
              }}>{trackerSnap.gatedOut ? 'REJECTED' : 'PASS'}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Gate Visualization ── */}
      {trackerSnap && trackerSnap.state !== TrackerState.UNINITIALIZED && (
        <div className="hfp-gate-viz">
          <svg viewBox="0 0 120 120" width="120" height="120">
            {/* Gate circle */}
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="60" cy="60" r={Math.min(50, (8 / gateRadius) * 50)} fill="none" stroke="var(--accent-green)" strokeWidth="1" opacity="0.5" />

            {/* Center crosshair (predicted) */}
            <line x1="55" y1="60" x2="65" y2="60" stroke="var(--text-muted)" strokeWidth="0.5" />
            <line x1="60" y1="55" x2="60" y2="65" stroke="var(--text-muted)" strokeWidth="0.5" />

            {/* Classical detection */}
            {detectors.classical && (
              <circle
                cx={60 + Math.max(-45, Math.min(45, (detectors.classical.x - (trackerSnap?.x || 320)) * 0.5))}
                cy={60 + Math.max(-45, Math.min(45, (detectors.classical.y - (trackerSnap?.y || 240)) * 0.5))}
                r="3" fill="var(--accent-blue)" opacity="0.9"
              />
            )}
            {/* AI detection */}
            {detectors.ai && (
              <circle
                cx={60 + Math.max(-45, Math.min(45, (detectors.ai.x - (trackerSnap?.x || 320)) * 0.5))}
                cy={60 + Math.max(-45, Math.min(45, (detectors.ai.y - (trackerSnap?.y || 240)) * 0.5))}
                r="3" fill="var(--accent-purple)" opacity="0.9"
              />
            )}
            {/* Fused accepted centroid */}
            {fusionState.centroid && (
              <circle
                cx={60 + Math.max(-45, Math.min(45, (fusionState.centroid.x - (trackerSnap?.x || 320)) * 0.5))}
                cy={60 + Math.max(-45, Math.min(45, (fusionState.centroid.y - (trackerSnap?.y || 240)) * 0.5))}
                r="4" fill="none" stroke={ds.color} strokeWidth="1.5"
              />
            )}
          </svg>
          <div className="hfp-gate-legend">
            <span><span style={{ color: 'var(--accent-blue)' }}>●</span> Classical</span>
            <span><span style={{ color: 'var(--accent-purple)' }}>●</span> AI</span>
            <span><span style={{ color: ds.color }}>○</span> Fused</span>
          </div>
        </div>
      )}
    </div>
  );
}

function DetectorBar({ label, detection, color, active }) {
  const conf = detection ? detection.confidence : 0;
  return (
    <div className="hfp-det-bar">
      <div className="hfp-det-header">
        <span className="hfp-det-dot" style={{ background: active ? color : 'var(--text-muted)' }} />
        <span className="hfp-det-label">{label}</span>
        <span className="hfp-det-conf mono" style={{ color: active ? color : 'var(--text-muted)' }}>
          {active ? `${(conf * 100).toFixed(0)}%` : 'OFF'}
        </span>
      </div>
      <div className="hfp-det-track">
        <div className="hfp-det-fill" style={{
          width: `${conf * 100}%`,
          background: active ? color : 'var(--text-muted)',
          opacity: active ? 1 : 0.3,
        }} />
      </div>
      {active && detection && (
        <div className="hfp-det-coords mono">
          ({detection.x.toFixed(0)}, {detection.y.toFixed(0)})
        </div>
      )}
    </div>
  );
}
