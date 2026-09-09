import React, { useState, useRef, useEffect } from 'react';
import { useSimStore } from '../store/simStore';

/**
 * Telemetry CSV Export
 * 
 * Inspired by competitor's 42-column CSV export capability.
 * Collects live simulation telemetry and exports as timestamped CSV on button click.
 */

// All telemetry columns — mirrors the competitor's approach
const COLUMNS = [
  'timestamp', 'sim_time', 'frame',
  // UAV state
  'uav_id', 'uav_x', 'uav_y', 'uav_z', 'uav_altitude', 'uav_speed',
  'tracking_state', 'confidence', 'pointing_error_px',
  // Link state
  'link_from', 'link_to', 'link_state', 'link_distance_km',
  'angular_error_urad', 'predicted_error_urad', 'link_confidence',
  'received_power_dBm', 'link_margin_dB', 'los_clear',
  // Environment
  'environment', 'scenario', 'turbulence', 'noise',
  // Pipeline latencies
  'lat_detection_ms', 'lat_estimation_ms', 'lat_prediction_ms',
  'lat_control_ms', 'lat_actuation_ms',
  // Fusion / Tracker (new columns)
  'fusion_decision', 'fusion_confidence', 'agreement_dist_px',
  'tracker_state', 'tracker_x', 'tracker_y',
  'tracker_vx', 'tracker_vy', 'innovation_px',
  'gate_result', 'track_age', 'coast_frames',
];

export default function TelemetryExport() {
  const store = useSimStore();
  const [buffer, setBuffer] = useState([]);
  const [recording, setRecording] = useState(false);
  const frameRef = useRef(0);

  // Collect telemetry while recording
  useEffect(() => {
    if (!recording || !store.simRunning || store.simPaused) return;

    const interval = setInterval(() => {
      frameRef.current++;

      const now = new Date().toISOString();
      const uavs = store.uavs.slice(0, store.numUAVs);
      const links = store.links;

      // One row per UAV
      uavs.forEach((uav, i) => {
        const link = links.find(l => l.from === i) || {};

        const row = {
          timestamp: now,
          sim_time: store.simTime.toFixed(3),
          frame: frameRef.current,
          uav_id: uav.id,
          uav_x: uav.position[0].toFixed(2),
          uav_y: uav.position[1].toFixed(2),
          uav_z: uav.position[2].toFixed(2),
          uav_altitude: uav.altitude,
          uav_speed: uav.speed,
          tracking_state: uav.trackingState,
          confidence: uav.confidence.toFixed(4),
          pointing_error_px: uav.pointingError.toFixed(2),
          link_from: link.from ?? '',
          link_to: link.to ?? '',
          link_state: link.state ?? '',
          link_distance_km: (link.distance || 0).toFixed(3),
          angular_error_urad: (link.angularError || 0).toFixed(4),
          predicted_error_urad: (link.predictedError || 0).toFixed(4),
          link_confidence: (link.confidence || 0).toFixed(4),
          received_power_dBm: (link.receivedPower || -30).toFixed(2),
          link_margin_dB: (link.linkMargin || 0).toFixed(2),
          los_clear: link.losClear ? 1 : 0,
          environment: store.environment,
          scenario: store.scenario,
          turbulence: store.turbulenceStrength.toFixed(3),
          noise: store.noiseStrength.toFixed(3),
          lat_detection_ms: store.patLatencies.targetDetection.toFixed(2),
          lat_estimation_ms: store.patLatencies.stateEstimation.toFixed(2),
          lat_prediction_ms: store.patLatencies.motionPrediction.toFixed(2),
          lat_control_ms: store.patLatencies.pointingControl.toFixed(2),
          lat_actuation_ms: store.patLatencies.cameraActuation.toFixed(2),
          // Fusion columns (placeholder — wired when HybridFusionPanel is active)
          fusion_decision: '',
          fusion_confidence: '',
          agreement_dist_px: '',
          tracker_state: '',
          tracker_x: '',
          tracker_y: '',
          tracker_vx: '',
          tracker_vy: '',
          innovation_px: '',
          gate_result: '',
          track_age: '',
          coast_frames: '',
        };

        setBuffer(prev => [...prev, row]);
      });
    }, 200); // 5 Hz capture rate

    return () => clearInterval(interval);
  }, [recording, store.simRunning, store.simPaused, store.simTime]);

  const exportCSV = () => {
    if (buffer.length === 0) return;

    const header = COLUMNS.join(',');
    const rows = buffer.map(row =>
      COLUMNS.map(col => {
        const val = row[col] ?? '';
        // Escape commas in values
        return String(val).includes(',') ? `"${val}"` : val;
      }).join(',')
    );

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `virtupat_telemetry_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    store.addEvent(`Exported ${buffer.length} telemetry rows (${COLUMNS.length} columns)`);
  };

  const clearBuffer = () => {
    setBuffer([]);
    frameRef.current = 0;
  };

  const fileSizeKB = (buffer.length * COLUMNS.length * 8 / 1024).toFixed(1);

  return (
    <div className="telemetry-export">
      <div className="te-header">
        <div>
          <div className="te-title">Telemetry Export</div>
          <div className="te-subtitle">{COLUMNS.length}-column CSV · {buffer.length} rows · ~{fileSizeKB} KB</div>
        </div>
      </div>
      <div className="te-controls">
        <button
          className={`sim-btn ${recording ? 'sim-btn-danger' : 'sim-btn-primary'}`}
          onClick={() => {
            if (!recording) {
              clearBuffer();
              store.addEvent('Telemetry recording started');
            } else {
              store.addEvent('Telemetry recording stopped');
            }
            setRecording(!recording);
          }}
        >
          {recording ? '⏹ Stop Recording' : '⏺ Record'}
        </button>
        <button
          className="sim-btn"
          onClick={exportCSV}
          disabled={buffer.length === 0}
          style={{ opacity: buffer.length === 0 ? 0.4 : 1 }}
        >
          📥 Export CSV
        </button>
        <button
          className="sim-btn"
          onClick={clearBuffer}
          disabled={buffer.length === 0}
          style={{ opacity: buffer.length === 0 ? 0.4 : 1 }}
        >
          🗑 Clear
        </button>
      </div>
      {recording && (
        <div className="te-recording-indicator">
          <span className="te-rec-dot" />
          <span className="mono" style={{ fontSize: '9px', color: 'var(--accent-red)' }}>
            REC · {buffer.length} rows
          </span>
        </div>
      )}

      {/* Column preview */}
      <div className="te-columns">
        <div className="te-col-label">Columns ({COLUMNS.length})</div>
        <div className="te-col-list">
          {COLUMNS.map(col => (
            <span key={col} className="te-col-tag">{col}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
