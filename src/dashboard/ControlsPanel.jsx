import React from 'react';
import { useSimStore, ScenarioLabel, DetectorMode } from '../store/simStore';
import { usePerfLogStore } from '../store/perfLogStore';

export default function ControlsPanel() {
  const store = useSimStore();
  const perfLogStore = usePerfLogStore();

  return (
    <div className="controls-panel">
      {/* ── PART 4 CONFIGURATION ── */}
      <div className="panel-section">
        <div className="panel-section-title">Part 4: Run Config</div>
        
        <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Scenario</label>
        <select className="sim-select" value={store.p4Scenario} onChange={e => store.setP4Scenario(e.target.value)} disabled={store.p4RunActive}>
          {Object.values(ScenarioLabel).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginTop: 6, marginBottom: 2 }}>Detector Mode</label>
        <select className="sim-select" value={store.detectorMode} onChange={e => store.setDetectorMode(e.target.value)} disabled={store.p4RunActive}>
          {Object.values(DetectorMode).map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginTop: 6, marginBottom: 2 }}>Search Pattern</label>
        <select className="sim-select" value={store.searchPattern} onChange={e => store.setSearchPattern(e.target.value)} disabled={store.p4RunActive}>
          <option value="raster">Raster Scan</option>
          <option value="spiral">Spiral Sweep</option>
        </select>
        
        <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginTop: 6, marginBottom: 2 }}>Seed (Reproducibility)</label>
        <input 
          type="number" 
          className="sim-input" 
          value={store.simSeed} 
          onChange={e => useSimStore.setState({ simSeed: parseInt(e.target.value) || 0 })}
          disabled={store.p4RunActive}
          style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', color: 'var(--text-bright)', padding: '2px 4px', fontSize: '10px' }}
        />
      </div>

      <div className="panel-section">
        <div className="panel-section-title">Disturbance Severity</div>
        {[
          { label: 'Turbulence', key: 'turbulenceSeverity', setter: store.setTurbulenceSeverity },
          { label: 'Occlusion', key: 'occlusionSeverity', setter: store.setOcclusionSeverity },
          { label: 'Sun Glint', key: 'sunGlintSeverity', setter: store.setSunGlintSeverity },
          { label: 'Dropout', key: 'dropoutSeverity', setter: store.setDropoutSeverity },
        ].map(({ label, key, setter }) => (
          <div key={key} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: 2 }}>
              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
              <span className="mono">{store[key].toFixed(2)}</span>
            </div>
            <input 
              className="sim-slider" 
              type="range" 
              min="0" max="1" step="0.05" 
              value={store[key]} 
              onChange={e => setter(+e.target.value)} 
            />
          </div>
        ))}
      </div>

      <div className="panel-section">
        <div className="panel-section-title">Run Controls</div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', flexDirection: 'column' }}>
          {!store.p4RunActive ? (
            <button className="sim-btn sim-btn-primary" onClick={() => store.resetPart4(store.p4Scenario, store.detectorMode, store.simSeed)}>
              ▶ Start P4 Run
            </button>
          ) : (
            <>
              <button className="sim-btn sim-btn-danger" onClick={() => {
                const row = store.finishP4Run();
                if (row) {
                  perfLogStore.addRun(row);
                }
              }}>
                ⏹ Finish Run
              </button>
              <button className="sim-btn" onClick={() => store.setSimPaused(!store.simPaused)}>
                {store.simPaused ? '▶ Resume' : '⏸ Pause'}
              </button>
            </>
          )}
          <button className="sim-btn" onClick={() => store.setPerformanceLogOpen(true)} style={{ marginTop: '8px' }}>
            📊 Performance Log
          </button>
        </div>
      </div>
      
      <div className="panel-section">
        <div className="panel-section-title">Sim Speed</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input className="sim-slider" type="range" min="0.25" max="10" step="0.25" value={store.simSpeed} onChange={e => store.setSimSpeed(parseFloat(e.target.value))} />
          <span className="mono" style={{ minWidth: '30px', fontSize: '9px' }}>{store.simSpeed.toFixed(1)}x</span>
        </div>
      </div>
    </div>
  );
}
