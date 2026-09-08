import React from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';

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
import { TurbulenceEffect } from './scene/TurbulenceEffect';
import { SensorNoiseEffect } from './scene/SensorNoiseEffect';

function App() {
  return (
    <div className="dashboard">
      <HeaderBar />
      <LeftSidebar />
      
      {/* ─── Main 3D View ─── */}
      <div className="main-3d-view">
        <Canvas gl={{ preserveDrawingBuffer: true, antialias: true, alpha: false }}>
          <color attach="background" args={['#0a0a0a']} />
          <CameraRig />
          <MissionWorld />
        </Canvas>
      </div>

      <RightSidebar />
      <CameraFeedsRow />

      {/* ─── Bottom Panels ─── */}
      <div className="bottom-panels">
        <PATpipeline />
        <TrackingPerformanceChart />
        <LinkAnalysis />
        <SystemPerformance />
        <EventLog />
      </div>
      
      {/* Absolute footer for sponsor text */}
      <div style={{ 
        position: 'absolute', bottom: 4, left: 24, right: 24, 
        display: 'flex', justifyContent: 'space-between', 
        fontSize: '8px', color: 'var(--text-muted)', 
        pointerEvents: 'none', zIndex: 100 
      }}>
        <div>Indian Space Research Organisation (Problem Statement: SIH26169)</div>
        <div>Mode: Research Prototype</div>
        <div>Towards a Connected Tomorrow | FSOC for a Brighter India</div>
      </div>
    </div>
  );
}

export default App;
