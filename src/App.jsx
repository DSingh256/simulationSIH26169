import React from 'react';
import { Canvas } from '@react-three/fiber';

import HeaderBar from './dashboard/HeaderBar';
import LeftSidebar from './dashboard/LeftSidebar';
import RightSidebar from './dashboard/RightSidebar';
import CameraFeedsRow from './dashboard/CameraFeedsRow';
import PATpipeline from './dashboard/PATpipeline';
import TrackingPerformanceChart from './dashboard/TrackingPerformanceChart';
import LinkAnalysis from './dashboard/LinkAnalysis';
import SystemPerformance from './dashboard/SystemPerformance';
import EventLog from './dashboard/EventLog';

import CameraRig from './scene/CameraRig';
import MissionWorld from './scene/MissionWorld';

function App() {
  return (
    <div className="dashboard">
      <HeaderBar />

      <div className="main-content">
        <LeftSidebar />

        <div className="center-column">
          {/* 3D Viewport */}
          <div className="section-heading">
            <span>Operational View</span>
            <span className="section-tag">3D Render</span>
          </div>
          <div className="main-3d-view">
            <Canvas gl={{ preserveDrawingBuffer: true, antialias: true, alpha: false }}>
              <color attach="background" args={['#0a0a0a']} />
              <CameraRig />
              <MissionWorld />
            </Canvas>
          </div>

          {/* Camera Feeds */}
          <div className="section-heading">
            <span>Vision Feeds</span>
            <span className="section-tag">Detection Active</span>
          </div>
          <CameraFeedsRow />

          {/* Bottom Panels */}
          <div className="section-heading">
            <span>Telemetry</span>
            <span className="section-tag">Pipeline / Performance / Link</span>
          </div>
          <div className="bottom-panels">
            <PATpipeline />
            <TrackingPerformanceChart />
            <LinkAnalysis />
            <SystemPerformance />
            <EventLog />
          </div>
        </div>

        <RightSidebar />
      </div>

      <div className="dashboard-footer">
        <div>ISRO — SIH26169</div>
        <div>VirtuPAT v0.3</div>
      </div>
    </div>
  );
}

export default App;
