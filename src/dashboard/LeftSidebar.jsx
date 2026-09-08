import React from 'react';
import { useSimStore } from '../store/simStore';

const DISTURBANCE_LABELS = {
  atmosphericTurbulence: 'Atmospheric Turbulence',
  platformVibration: 'Platform Vibration',
  cameraMotion: 'Camera Motion',
  imageNoise: 'Image Noise',
  motionBlur: 'Motion Blur',
  temporaryOcclusion: 'Temporary Occlusion',
  weatherEffects: 'Weather Effects',
};

export default function LeftSidebar() {
  const store = useSimStore();

  return (
    <div className="left-sidebar">
      {/* ─── Mission Configuration ─── */}
      <div className="panel-section">
        <div className="panel-section-title">Mission Configuration</div>

        <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Number of UAVs</label>
        <select className="sim-select" value={store.numUAVs} onChange={e => store.setNumUAVs(+e.target.value)}>
          {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: 8, marginBottom: 2 }}>Environment</label>
        <select className="sim-select" value={store.environment} onChange={e => store.setEnvironment(e.target.value)}>
          <option value="CLEAR">Clear</option>
          <option value="CLOUDY_DYNAMIC">Cloudy (Dynamic)</option>
          <option value="OVERCAST">Overcast</option>
          <option value="NIGHT">Night</option>
        </select>

        <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: 8, marginBottom: 2 }}>Scenario</label>
        <select className="sim-select" value={store.scenario} onChange={e => store.setScenario(e.target.value)}>
          <option value="MULTI_UAV_MESH">Multi-UAV Mesh</option>
          <option value="POINT_TO_POINT">Point-to-Point</option>
          <option value="RELAY_CHAIN">Relay Chain</option>
          <option value="STAR_TOPOLOGY">Star Topology</option>
        </select>

        <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: 8, marginBottom: 2 }}>Trajectory Type</label>
        <select className="sim-select" value={store.trajectoryType} onChange={e => store.setTrajectoryType(e.target.value)}>
          <option value="MIXED">Mixed (Custom)</option>
          <option value="LINEAR">Linear</option>
          <option value="CIRCULAR">Circular</option>
          <option value="RANDOM_WALK">Random Walk</option>
        </select>
      </div>

      {/* ─── UAV Parameters ─── */}
      <div className="panel-section">
        <div className="panel-section-title">UAV Parameters</div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: 2 }}>
          <span style={{ color: 'var(--text-muted)' }}>Speed (m/s)</span>
          <span className="mono" style={{ color: 'var(--text-primary)' }}>{store.globalSpeed}</span>
        </div>
        <input className="sim-slider" type="range" min="5" max="80" value={store.globalSpeed} onChange={e => store.setGlobalSpeed(+e.target.value)} />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginTop: 8, marginBottom: 2 }}>
          <span style={{ color: 'var(--text-muted)' }}>Altitude (m)</span>
          <span className="mono" style={{ color: 'var(--text-primary)' }}>{store.globalAltitude}</span>
        </div>
        <input className="sim-slider" type="range" min="200" max="2000" value={store.globalAltitude} onChange={e => store.setGlobalAltitude(+e.target.value)} />
      </div>

      {/* ─── Disturbances ─── */}
      <div className="panel-section">
        <div className="panel-section-title">Disturbances</div>
        {Object.entries(DISTURBANCE_LABELS).map(([key, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', padding: '2px 0', fontSize: '10px' }}>
            <input 
              type="checkbox" 
              className="sim-checkbox"
              checked={store.disturbances[key]}
              onChange={e => store.setDisturbance(key, e.target.checked)}
            />
            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ─── Simulation Controls ─── */}
      <div className="panel-section">
        <div className="panel-section-title">Simulation Controls</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button 
            className="sim-btn sim-btn-primary" 
            onClick={() => { store.setSimRunning(true); store.setSimPaused(false); }}
          >▶ Start</button>
          <button 
            className="sim-btn" 
            onClick={() => store.setSimPaused(!store.simPaused)}
          >⏸ Pause</button>
          <button 
            className="sim-btn" 
            onClick={() => store.resetSim()}
          >↺ Reset</button>
          <button 
            className="sim-btn sim-btn-danger" 
            onClick={() => store.setSimRunning(false)}
          >⏹ Stop</button>
        </div>
      </div>

      {/* ─── Simulation Speed ─── */}
      <div className="panel-section">
        <div className="panel-section-title">Simulation Speed</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input 
            className="sim-slider" type="range" 
            min="0.25" max="10" step="0.25" 
            value={store.simSpeed}
            onChange={e => store.setSimSpeed(parseFloat(e.target.value))}
          />
          <span className="mono" style={{ fontSize: '11px', minWidth: '35px' }}>{store.simSpeed.toFixed(1)}x</span>
        </div>
        <div style={{ display: 'flex', gap: '4px', marginTop: 4, flexWrap: 'wrap' }}>
          {[0.25, 0.5, 1, 2, 5, 10].map(v => (
            <button 
              key={v}
              className="sim-btn" 
              style={{ padding: '2px 6px', fontSize: '9px' }}
              onClick={() => store.setSimSpeed(v)}
            >{v}x</button>
          ))}
        </div>
      </div>

      {/* ─── Challenge Mode ─── */}
      <div className="panel-section">
        <div className="panel-section-title">Challenge Mode</div>
        <button className="sim-btn" style={{ width: '100%', marginBottom: 4 }} onClick={() => store.addEvent('Stress Test Initiated')}>Run Stress Test</button>
        <button className="sim-btn" style={{ width: '100%' }} onClick={() => store.addEvent('Baseline Comparison Started')}>Run Baseline Comparison</button>
      </div>

      {/* ─── Footer ─── */}
      <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', fontSize: '9px', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="sim-btn" style={{ flex: 1, fontSize: '9px' }} onClick={() => store.addEvent('Configuration Saved')}>💾 Save Config</button>
          <button className="sim-btn" style={{ flex: 1, fontSize: '9px' }} onClick={() => store.addEvent('Configuration Loaded')}>📂 Load Config</button>
        </div>
      </div>
    </div>
  );
}
