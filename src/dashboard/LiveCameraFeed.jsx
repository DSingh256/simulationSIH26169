import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';

import { useSimStore } from '../store/simStore';
import { TurbulenceEffect } from '../scene/TurbulenceEffect';
import { SensorNoiseEffect } from '../scene/SensorNoiseEffect';
import TrackerController from '../sim/TrackerController';
import UAVNode from '../scene/UAVNode';

// A camera that rigidly attaches to source UAV and looks at target UAV (plus PID corrections)
function TrackingCameraRig({ sourcePos, targetPos }) {
  const cameraRef = useRef();
  const fov = useSimStore((state) => state.fov);
  const cameraCorrection = useSimStore((state) => state.cameraCorrection);
  
  useFrame(() => {
    if (cameraRef.current) {
      cameraRef.current.position.set(...sourcePos);
      cameraRef.current.lookAt(...targetPos);
      // Apply the cumulative PID correction as a small rotation
      cameraRef.current.rotation.y += -cameraCorrection.x * 0.1;
      cameraRef.current.rotation.x += cameraCorrection.y * 0.1;
      
      cameraRef.current.fov = fov;
      cameraRef.current.updateProjectionMatrix();
    }
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      near={1}
      far={15000}
    />
  );
}

// Scene specifically for the live feed — renders buildings and target UAV as seen through sensor
function LiveScene({ targetUav, buildings }) {
  const buildingTexture = useLoader(THREE.TextureLoader, '/building.jpg');

  const buildingMat = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      map: buildingTexture.clone(),
      roughness: 0.5,
      metalness: 0.5,
    });
    mat.map.wrapS = THREE.RepeatWrapping;
    mat.map.wrapT = THREE.RepeatWrapping;
    mat.map.repeat.set(2, 4);
    return mat;
  }, [buildingTexture]);

  return (
    <>
      <color attach="background" args={['#030308']} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[1000, 2000, 1000]} intensity={1.5} />
      <fog attach="fog" args={['#030308', 1000, 10000]} />
      
      {/* Render the actual drone model */}
      <UAVNode uav={targetUav} isActive={true} />
      
      {/* Invisible bright core to ensure detector threshold always has something to lock onto from far away */}
      <mesh position={targetUav.position}>
        <sphereGeometry args={[10, 16, 16]} />
        <meshBasicMaterial color="#fff" toneMapped={false} />
      </mesh>
      <pointLight position={targetUav.position} color="#ffffff" intensity={3} distance={200} />
      
      {/* Decoy glint if active */}
      {useSimStore.getState().sunGlintActive && (
        <mesh position={[targetUav.position[0] + 50, targetUav.position[1] - 30, targetUav.position[2]]}>
          <sphereGeometry args={[10, 16, 16]} />
          <meshStandardMaterial color="#ffe" emissive="#ffe" emissiveIntensity={4} toneMapped={false} />
        </mesh>
      )}

      {/* Buildings that can occlude the target — dark silhouettes with subtle texture */}
      {buildings.map((b, i) => (
        <mesh key={`b-${i}`} position={[b.x, b.height / 2, b.z]} material={buildingMat}>
          <boxGeometry args={[b.width, b.height, b.depth]} />
        </mesh>
      ))}
      
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[10000, 10000]} />
        <meshStandardMaterial color="#050508" />
      </mesh>
    </>
  );
}

export default function LiveCameraFeed({ sourceUav, targetUav, uavIndex }) {
  const store = useSimStore();
  const signalDropoutActive = store.signalDropoutActive;
  const buildings = store.buildings;
  const disturbances = store.disturbances;
  const turbulenceStrength = store.turbulenceStrength;
  const noiseStrength = store.noiseStrength;
  
  // Find link state for this feed
  const link = store.links.find(l => l.from === uavIndex);
  const isLost = link && link.state === 'LOST';



  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', filter: signalDropoutActive ? 'brightness(0)' : 'none' }}>
      <Canvas gl={{ preserveDrawingBuffer: true, antialias: false, alpha: false }}>
        <LiveScene targetUav={targetUav} buildings={buildings} />
        <TrackingCameraRig sourcePos={sourceUav.position} targetPos={targetUav.position} />
        <TrackerController uavIndex={uavIndex} targetUav={targetUav} />
        
        <EffectComposer disableNormalPass>
          {disturbances.atmosphericTurbulence && (
            <TurbulenceEffect intensity={turbulenceStrength * 5.0} />
          )}
          {disturbances.imageNoise && (
            <SensorNoiseEffect intensity={noiseStrength * 2.0} />
          )}
          <Bloom intensity={1.0} luminanceThreshold={0.5} luminanceSmoothing={0.9} />
          <ChromaticAberration offset={[0.0005, 0.0005]} />
          <Vignette eskil={false} offset={0.1} darkness={0.8} />
        </EffectComposer>
      </Canvas>
      {isLost && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.8), rgba(0,0,0,0.8) 2px, transparent 2px, transparent 4px), rgba(255, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          zIndex: 10
        }}>
          <div style={{ color: '#ff2222', fontSize: '24px', fontWeight: 'bold', letterSpacing: '2px', textShadow: '0 0 10px red' }}>
            NO SIGNAL
          </div>
          <div style={{ color: '#ff2222', fontSize: '10px', marginTop: 8 }}>
            LOS OCCLUDED
          </div>
        </div>
      )}
      {sourceUav.trackingState === 'REACQUIRING' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          border: '2px dashed #8a7aaa',
          animation: 'pulse-reacquire 1.5s infinite linear',
          pointerEvents: 'none'
        }}>
          <div style={{ position: 'absolute', top: '-18px', left: '50%', transform: 'translateX(-50%)', color: '#8a7aaa', fontSize: '9px', whiteSpace: 'nowrap', letterSpacing: '0.5px' }}>
            SCANNING
          </div>
        </div>
      )}
      <style>{`
        @keyframes pulse-reacquire {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
