import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useSimStore } from './store/simStore';

import HeaderBar from './dashboard/HeaderBar';
import ControlsPanel from './dashboard/ControlsPanel';
import CameraFeedsSection from './dashboard/CameraFeedsSection';
import TrackingPerformanceChart from './dashboard/TrackingPerformanceChart';
import PATpipeline from './dashboard/PATpipeline';
import LinkAnalysis from './dashboard/LinkAnalysis';
import SystemPerformance from './dashboard/SystemPerformance';
import EventLog from './dashboard/EventLog';
import UAVTableSection from './dashboard/UAVTableSection';

import CameraRig from './scene/CameraRig';
import MissionWorld from './scene/MissionWorld';

function App() {
  const [showControls, setShowControls] = useState(true);
  const store = useSimStore();
  const uavs = store.uavs.slice(0, store.numUAVs);
  const links = store.links;
  
  const lockedLinks = links.filter(l => l.state === 'LOCKED').length;
  const avgConf = uavs.length > 0 ? (uavs.reduce((s, u) => s + u.confidence, 0) / uavs.length) : 0;
  const link0 = links[0] || {};

  return (
    <div>
      {/* ═══ HEADER ═══ */}
      <HeaderBar />

      {/* ═══ STATUS SUB-BAR ═══ */}
      <div className="status-subbar">
        <div style={{ display: 'flex', gap: 20 }}>
          <span>SIM {store.simRunning ? (store.simPaused ? 'PAUSED' : 'ACTIVE') : 'IDLE'}</span>
          <span>T+ {store.simTime.toFixed(1)}s</span>
          <span>{store.numUAVs} NODES</span>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <span>ENV: {store.environment}</span>
          <span>SCENARIO: {store.scenario.replace(/_/g, ' ')}</span>
          <span>ATTEN {(store.opticalAttenuationDbKm ?? 0).toFixed(2)} dB/km</span>
          <span>{store.simSpeed.toFixed(1)}x RT</span>
        </div>
      </div>

      {/* ═══ HERO ═══ */}
      <div className="hero-section">
        <h1>VirtuPAT Terminal<br/>Alignment</h1>
        <div className="hero-sub">
          PAT pipeline simulation for coarse alignment of mobile FSOC terminals.
          Multi-UAV mesh tracking with closed-loop pointing control.
        </div>
      </div>

      {/* ═══ STATS ROW ═══ */}
      <div className="stats-row">
        <div className="stat-cell">
          <div className="stat-label">Wavelength</div>
          <div className="stat-value">1550 <span className="stat-unit">nm</span></div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Avg Pointing Error</div>
          <div className="stat-value">{(link0.angularError || 0).toFixed(3)} <span className="stat-unit">µrad</span></div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Link Margin</div>
          <div className="stat-value">{(link0.linkMargin || 0).toFixed(1)} <span className="stat-unit">dB</span></div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Active Node</div>
          <div className="stat-value">{uavs[0]?.id || 'N/A'}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Rx Power</div>
          <div className="stat-value">{(link0.receivedPower || -30).toFixed(1)} <span className="stat-unit">dBm</span></div>
        </div>
        <div className="stat-cell highlight">
          <div className="stat-label">Locked Links</div>
          <div className="stat-value">{lockedLinks} / {links.length}</div>
        </div>
      </div>

      {/* ═══ TWO-COL: 3D VIEW + PIPELINE ═══ */}
      <div className="section-bar">
        <div>
          <div className="section-tag">Operational View</div>
        </div>
        <div className="section-tag">Closed Loop Budget</div>
      </div>
      <div className="two-col wide-left">
        <div className="col-section">
          <div className="col-section-label">
            <span>3D Test Aperture Range</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9 }}>{store.numUAVs} nodes</span>
          </div>
          <div className="viewport-3d">
            <Canvas gl={{ preserveDrawingBuffer: true, antialias: true, alpha: false }}>
              <CameraRig />
              <MissionWorld />
            </Canvas>
          </div>
        </div>
        <div className="col-section">
          <div className="col-section-label">
            <span>Pipeline Latency</span>
          </div>
          <PATpipeline />
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
            <div className="col-section-label"><span>Performance</span></div>
            <SystemPerformance />
          </div>
        </div>
      </div>

      {/* ═══ FULL-WIDTH CHART ═══ */}
      <div className="section-bar">
        <div className="section-tag">Pointing Error Timeline</div>
        <div className="section-tag">Live</div>
      </div>
      <TrackingPerformanceChart />

      {/* ═══ CAMERA FEEDS (3-card grid) ═══ */}
      <CameraFeedsSection />

      {/* ═══ TWO-COL: LINK ANALYSIS + EVENT LOG ═══ */}
      <div className="section-bar">
        <div className="section-tag">Link Analysis</div>
        <div className="section-tag">Event Log</div>
      </div>
      <div className="two-col">
        <div className="col-section">
          <LinkAnalysis />
        </div>
        <div className="col-section">
          <EventLog />
        </div>
      </div>

      {/* ═══ UAV TABLE ═══ */}
      <UAVTableSection />

      {/* ═══ FOOTER ═══ */}
      <div className="dashboard-footer">
        <div>ISRO — SIH26169</div>
        <div>VirtuPAT v0.3</div>
      </div>

      {/* ═══ FLOATING CONTROLS ═══ */}
      <button className="controls-toggle" onClick={() => setShowControls(!showControls)}>
        {showControls ? '✕' : '⚙'}
      </button>
      {showControls && <ControlsPanel />}
    </div>
  );
}

export default App;
