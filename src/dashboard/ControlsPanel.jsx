import React from 'react';
import { useSimStore } from '../store/simStore';
import { ENV_PRESETS } from '../sim/simConfig';

const DISTURBANCE_LABELS = {
  atmosphericTurbulence: 'Atm. Turbulence',
  platformVibration: 'Platform Vibration',
  cameraMotion: 'Camera Motion',
  imageNoise: 'Image Noise',
  motionBlur: 'Motion Blur',
  temporaryOcclusion: 'Occlusion',
  weatherEffects: 'Weather',
};

const TIME_SCALES = [0.25, 0.5, 1, 2, 5, 10];

export default function ControlsPanel() {
  const store = useSimStore();
  const env = ENV_PRESETS[store.environment] || ENV_PRESETS.CLOUDY_DYNAMIC;
  const paused = store.simPaused && store.simRunning;

  return (
    <div className="controls-panel">
      <div className="panel-section">
        <div className="panel-section-title">Mission</div>
        <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>UAVs</label>
        <select className="sim-select" value={store.numUAVs} onChange={(e) => store.setNumUAVs(+e.target.value)}>
          {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginTop: 6, marginBottom: 2 }}>Environment</label>
        <select className="sim-select" value={store.environment} onChange={(e) => store.setEnvironment(e.target.value)}>
          <option value="CLEAR">Clear</option>
          <option value="CLOUDY_DYNAMIC">Cloudy</option>
          <option value="OVERCAST">Overcast</option>
          <option value="NIGHT">Night</option>
        </select>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginTop: 4, color: 'var(--text-muted)' }}>
          <span>Optical atten.</span>
          <span className="mono">{(store.opticalAttenuationDbKm ?? 0).toFixed(2)} dB/km</span>
        </div>
        <div style={{ fontSize: '8px', color: 'var(--text-muted)', marginTop: 2 }}>
          {env.label} · ambient {env.ambient.toFixed(2)} · sun {env.sun.toFixed(2)}
        </div>
        <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginTop: 6, marginBottom: 2 }}>Scenario</label>
        <select className="sim-select" value={store.scenario} onChange={(e) => store.setScenario(e.target.value)}>
          <option value="MULTI_UAV_MESH">Mesh</option>
          <option value="POINT_TO_POINT">Point-to-Point</option>
          <option value="RELAY_CHAIN">Relay Chain</option>
          <option value="STAR_TOPOLOGY">Star</option>
        </select>
      </div>

      <div className="panel-section">
        <div className="panel-section-title">Parameters</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: 2 }}>
          <span style={{ color: 'var(--text-muted)' }}>Speed (m/s)</span>
          <span className="mono">{store.globalSpeed}</span>
        </div>
        <input className="sim-slider" type="range" min="5" max="80" value={store.globalSpeed} onChange={(e) => store.setGlobalSpeed(+e.target.value)} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginTop: 6, marginBottom: 2 }}>
          <span style={{ color: 'var(--text-muted)' }}>Altitude (m)</span>
          <span className="mono">{store.globalAltitude}</span>
        </div>
        <input className="sim-slider" type="range" min="200" max="2000" value={store.globalAltitude} onChange={(e) => store.setGlobalAltitude(+e.target.value)} />
      </div>

      <div className="panel-section">
        <div className="panel-section-title">Disturbances</div>
        {Object.entries(DISTURBANCE_LABELS).map(([key, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', padding: '1px 0', fontSize: '9px' }}>
            <input type="checkbox" className="sim-checkbox" checked={store.disturbances[key]} onChange={(e) => store.setDisturbance(key, e.target.checked)} />
            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
          </div>
        ))}
      </div>

      <div className="panel-section">
        <div className="panel-section-title">Controls</div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <button className="sim-btn sim-btn-primary" onClick={() => store.startSim()}>▶ Start</button>
          <button className="sim-btn" onClick={() => store.togglePause()}>{paused ? '▶ Resume' : '⏸ Pause'}</button>
          <button className="sim-btn" onClick={() => store.resetSim()}>↺ Reset</button>
          <button className="sim-btn sim-btn-danger" onClick={() => store.stopSim()}>⏹ Stop</button>
        </div>
        <div style={{ fontSize: '8px', color: 'var(--text-muted)', marginTop: 4 }}>
          T+ {store.simTime.toFixed(1)}s · {store.simRunning ? (store.simPaused ? 'PAUSED' : 'RUNNING') : 'STOPPED'}
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-section-title">Time Scale</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input className="sim-slider" type="range" min="0.25" max="10" step="0.25" value={store.simSpeed} onChange={(e) => store.setSimSpeed(parseFloat(e.target.value))} />
          <span className="mono" style={{ minWidth: '30px' }}>{store.simSpeed.toFixed(1)}x</span>
        </div>
        <div style={{ display: 'flex', gap: '3px', marginTop: 4, flexWrap: 'wrap' }}>
          {TIME_SCALES.map((v) => (
            <button
              key={v}
              className={store.simSpeed === v ? 'sim-btn sim-btn-primary' : 'sim-btn'}
              style={{ padding: '2px 5px', fontSize: '8px' }}
              onClick={() => store.setSimSpeed(v)}
            >
              {v}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
