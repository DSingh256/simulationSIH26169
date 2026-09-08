import React from 'react';
import { useSimStore } from '../store/simStore';

const DISTURBANCE_LABELS = {
  atmosphericTurbulence: 'Atm. Turbulence',
  platformVibration: 'Platform Vibration',
  cameraMotion: 'Camera Motion',
  imageNoise: 'Image Noise',
  motionBlur: 'Motion Blur',
  temporaryOcclusion: 'Occlusion',
  weatherEffects: 'Weather',
};

export default function LeftSidebar() {
  const store = useSimStore();

  return (
    <div className="left-sidebar">
      {/* ─── Mission ─── */}
      <div className="panel-section">
        <div className="panel-section-title">Mission</div>

        <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>UAVs</label>
        <select className="sim-select" value={store.numUAVs} onChange={e => store.setNumUAVs(+e.target.value)}>
          {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginTop: 6, marginBottom: 2 }}>Environment</label>
        <select className="sim-select" value={store.environment} onChange={e => store.setEnvironment(e.target.value)}>
          <option value="CLEAR">Clear</option>
          <option value="CLOUDY_DYNAMIC">Cloudy</option>
          <option value="OVERCAST">Overcast</option>
          <option value="NIGHT">Night</option>
        </select>

        <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginTop: 6, marginBottom: 2 }}>Scenario</label>
        <select className="sim-select" value={store.scenario} onChange={e => store.setScenario(e.target.value)}>
          <option value="MULTI_UAV_MESH">Mesh</option>
          <option value="POINT_TO_POINT">Point-to-Point</option>
          <option value="RELAY_CHAIN">Relay Chain</option>
          <option value="STAR_TOPOLOGY">Star</option>
        </select>

        <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginTop: 6, marginBottom: 2 }}>Trajectory</label>
        <select className="sim-select" value={store.trajectoryType} onChange={e => store.setTrajectoryType(e.target.value)}>
          <option value="MIXED">Mixed</option>
          <option value="LINEAR">Linear</option>
          <option value="CIRCULAR">Circular</option>
          <option value="RANDOM_WALK">Random Walk</option>
        </select>
      </div>

      {/* ─── Parameters ─── */}
      <div className="panel-section">
        <div className="panel-section-title">Parameters</div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: 2 }}>
          <span style={{ color: 'var(--text-muted)' }}>Speed (m/s)</span>
          <span className="mono" style={{ color: 'var(--text-primary)' }}>{store.globalSpeed}</span>
        </div>
        <input className="sim-slider" type="range" min="5" max="80" value={store.globalSpeed} onChange={e => store.setGlobalSpeed(+e.target.value)} />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginTop: 6, marginBottom: 2 }}>
          <span style={{ color: 'var(--text-muted)' }}>Altitude (m)</span>
          <span className="mono" style={{ color: 'var(--text-primary)' }}>{store.globalAltitude}</span>
        </div>
        <input className="sim-slider" type="range" min="200" max="2000" value={store.globalAltitude} onChange={e => store.setGlobalAltitude(+e.target.value)} />
      </div>

      {/* ─── Disturbances ─── */}
      <div className="panel-section">
        <div className="panel-section-title">Disturbances</div>
        {Object.entries(DISTURBANCE_LABELS).map(([key, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', padding: '1px 0', fontSize: '9px' }}>
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

      {/* ─── Controls ─── */}
      <div className="panel-section">
        <div className="panel-section-title">Controls</div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
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

      {/* ─── Speed ─── */}
      <div className="panel-section">
        <div className="panel-section-title">Speed</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input 
            className="sim-slider" type="range" 
            min="0.25" max="10" step="0.25" 
            value={store.simSpeed}
            onChange={e => store.setSimSpeed(parseFloat(e.target.value))}
          />
          <span className="mono" style={{ fontSize: '10px', minWidth: '30px' }}>{store.simSpeed.toFixed(1)}x</span>
        </div>
        <div style={{ display: 'flex', gap: '3px', marginTop: 4, flexWrap: 'wrap' }}>
          {[0.25, 0.5, 1, 2, 5, 10].map(v => (
            <button 
              key={v}
              className="sim-btn" 
              style={{ padding: '2px 5px', fontSize: '8px' }}
              onClick={() => store.setSimSpeed(v)}
            >{v}x</button>
          ))}
        </div>
      </div>

      {/* ─── Footer ─── */}
      <div style={{ marginTop: 'auto', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)', fontSize: '8px', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="sim-btn" style={{ flex: 1, fontSize: '8px' }} onClick={() => store.addEvent('Config saved')}>💾 Save</button>
          <button className="sim-btn" style={{ flex: 1, fontSize: '8px' }} onClick={() => store.addEvent('Config loaded')}>📂 Load</button>
        </div>
      </div>
    </div>
  );
}
