import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';

import { useSimStore } from '../store/simStore';
import { ENV_PRESETS, decoyWorldPositions } from '../sim/simConfig';
import { TurbulenceEffect } from '../scene/TurbulenceEffect';
import { SensorNoiseEffect } from '../scene/SensorNoiseEffect';
import TrackerController from '../sim/TrackerController';
import UAVNode from '../scene/UAVNode';
import RainParticles from '../scene/RainParticles';

const _look = new THREE.Vector3();
const _src = new THREE.Vector3();
const _tgt = new THREE.Vector3();
const _proj = new THREE.Vector3();

function TrackingCameraRig({ sourcePos, targetPos, trackingState }) {
  const cameraRef = useRef();
  const fov = useSimStore((state) => state.fov);
  const cameraCorrection = useSimStore((state) => state.cameraCorrection);

  useFrame(({ clock }) => {
    if (!cameraRef.current) return;
    const { disturbances, simRunning, simPaused, simSpeed, occlusionActive, simTime } = useSimStore.getState();
    _src.set(...sourcePos);
    _tgt.set(...targetPos);

    const searching = trackingState === 'SEARCHING' || trackingState === 'REACQUIRING';
    if (searching) {
      const t = simTime;
      const R = 280 + 380 * (0.5 + 0.5 * Math.cos(t * 0.55));
      const angle = t * 1.85;
      _tgt.set(
        targetPos[0] + Math.cos(angle) * R,
        targetPos[1] + Math.sin(t * 1.1) * 70,
        targetPos[2] + Math.sin(angle) * R
      );
    }

    _look.copy(_tgt).sub(_src);
    if (_look.lengthSq() < 1e-4) _look.set(0, 0, -1);
    else _look.normalize();
    cameraRef.current.position.copy(_src).addScaledVector(_look, -90);
    cameraRef.current.lookAt(_tgt);
    cameraRef.current.rotation.y += -cameraCorrection.x * 0.1;
    cameraRef.current.rotation.x += cameraCorrection.y * 0.1;

    if (simRunning && !simPaused && disturbances.cameraMotion) {
      const t = clock.getElapsedTime() * simSpeed;
      cameraRef.current.rotation.y += Math.sin(t * 7.3) * 0.004;
      cameraRef.current.rotation.x += Math.cos(t * 5.1) * 0.003;
    }
    if (simRunning && !simPaused && disturbances.platformVibration) {
      cameraRef.current.rotation.z = (Math.random() - 0.5) * 0.012;
    } else {
      cameraRef.current.rotation.z = 0;
    }
    if (occlusionActive) {
      cameraRef.current.rotation.y += 0.01;
    }

    cameraRef.current.fov = Math.max(fov, 14);
    cameraRef.current.updateProjectionMatrix();
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      fov={16}
      near={1}
      far={15000}
    />
  );
}

function MarkerProjector({ targetPos, decoys, trackingState, linkUp, hudRef, decoyRefs }) {
  useFrame(({ camera }) => {
    const hud = hudRef.current;
    _proj.set(targetPos[0], targetPos[1], targetPos[2]).project(camera);
    const inView = _proj.z < 1 && Math.abs(_proj.x) < 0.98 && Math.abs(_proj.y) < 0.98;
    const locked = trackingState === 'TRACKING' || trackingState === 'LOCKED';
    const seen = inView && linkUp && locked;
    if (hud) {
      if (inView) {
        hud.style.setProperty('--mx', `${(_proj.x * 0.5 + 0.5) * 100}%`);
        hud.style.setProperty('--my', `${(-_proj.y * 0.5 + 0.5) * 100}%`);
        hud.style.display = 'block';
      } else {
        hud.style.setProperty('--mx', '50%');
        hud.style.setProperty('--my', '50%');
        hud.style.display = locked ? 'none' : 'block';
      }
      const label = hud.querySelector('.lock-label');
      if (label) {
        if (trackingState === 'SEARCHING') label.textContent = 'SEARCHING';
        else if (seen) label.textContent = 'BEACON';
        else label.textContent = 'CONNECTION BROKEN';
      }
      hud.classList.toggle('ok', seen);
      hud.classList.toggle('lost', !seen);
      hud.classList.toggle('search', trackingState === 'SEARCHING');
    }

    decoys.forEach((d, i) => {
      const el = decoyRefs.current[i];
      if (!el) return;
      _proj.set(d.position[0], d.position[1], d.position[2]).project(camera);
      const vis = _proj.z < 1 && Math.abs(_proj.x) < 1.05 && Math.abs(_proj.y) < 1.05;
      el.style.display = vis ? 'block' : 'none';
      el.style.setProperty('--mx', `${(_proj.x * 0.5 + 0.5) * 100}%`);
      el.style.setProperty('--my', `${(-_proj.y * 0.5 + 0.5) * 100}%`);
    });
  });
  return null;
}

function LiveScene({ targetUav, buildings }) {
  const buildingTexture = useLoader(THREE.TextureLoader, '/building.jpg');
  const environment = useSimStore((s) => s.environment);
  const weatherOn = useSimStore((s) => s.disturbances.weatherEffects);
  const occlusionActive = useSimStore((s) => s.occlusionActive);
  const env = ENV_PRESETS[environment] || ENV_PRESETS.CLOUDY_DYNAMIC;
  const decoys = decoyWorldPositions(targetUav.position);

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
      <color attach="background" args={[env.bg]} />
      <ambientLight intensity={env.ambient * 0.85} />
      <directionalLight position={env.sunPosition} intensity={env.sun * 0.8} />
      <fog attach="fog" args={[env.fogColor, weatherOn ? 600 : 1000, weatherOn ? 6000 : 10000]} />

      {!occlusionActive && (
        <>
          <UAVNode uav={targetUav} isActive={true} />
          <mesh position={targetUav.position}>
            <sphereGeometry args={[12, 16, 16]} />
            <meshBasicMaterial color="#b8fff0" toneMapped={false} />
          </mesh>
          <pointLight position={targetUav.position} color="#ccffee" intensity={4} distance={240} />
        </>
      )}

      {decoys.map((d) => (
        <group key={d.id} position={d.position}>
          <mesh>
            <sphereGeometry args={[14, 16, 16]} />
            <meshBasicMaterial color={d.color} toneMapped={false} />
          </mesh>
          <pointLight color={d.color} intensity={5} distance={220} />
        </group>
      ))}

      {occlusionActive && (
        <mesh position={[targetUav.position[0] + 8, targetUav.position[1], targetUav.position[2] + 12]}>
          <boxGeometry args={[80, 90, 18]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      )}

      {buildings.map((b, i) => (
        <mesh key={`b-${i}`} position={[b.x, b.height / 2, b.z]} material={buildingMat}>
          <boxGeometry args={[b.width, b.height, b.depth]} />
        </mesh>
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[10000, 10000]} />
        <meshStandardMaterial color="#050508" />
      </mesh>

      {weatherOn && <RainParticles count={2200} spread={2800} ceiling={1800} />}
    </>
  );
}

export default function LiveCameraFeed({ sourceUav, targetUav, uavIndex, link }) {
  const signalDropoutActive = useSimStore((s) => s.signalDropoutActive);
  const buildings = useSimStore((s) => s.buildings);
  const disturbances = useSimStore((s) => s.disturbances);
  const occlusionActive = useSimStore((s) => s.occlusionActive);
  const simTime = useSimStore((s) => s.simTime);
  const bannerUntil = useSimStore((s) => s.acquisitionBannerUntil);
  const hudRef = useRef(null);
  const decoyRefs = useRef([]);
  const decoys = decoyWorldPositions(targetUav.position);
  const linkUp = !!(link && (link.state === 'LOCKED' || link.state === 'TRACKING') && !occlusionActive && !signalDropoutActive);
  const searching = sourceUav.trackingState === 'SEARCHING' || sourceUav.trackingState === 'REACQUIRING';
  const showAcquired = simTime < bannerUntil && (sourceUav.trackingState === 'TRACKING' || sourceUav.trackingState === 'LOCKED');

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      filter: signalDropoutActive
        ? 'brightness(0.15) contrast(1.4)'
        : disturbances.motionBlur
          ? 'blur(0.6px)'
          : 'none',
    }}
    >
      <Canvas gl={{ preserveDrawingBuffer: true, antialias: false, alpha: false }}>
        <LiveScene targetUav={targetUav} buildings={buildings} />
        <TrackingCameraRig sourcePos={sourceUav.position} targetPos={targetUav.position} trackingState={sourceUav.trackingState} />
        <MarkerProjector
          targetPos={targetUav.position}
          decoys={decoys}
          trackingState={sourceUav.trackingState}
          linkUp={linkUp}
          hudRef={hudRef}
          decoyRefs={decoyRefs}
        />
        <TrackerController uavIndex={uavIndex} targetUav={targetUav} />

        <EffectComposer disableNormalPass>
          <TurbulenceEffect />
          <SensorNoiseEffect />
          <Bloom intensity={1.2} luminanceThreshold={0.45} luminanceSmoothing={0.9} />
          <ChromaticAberration offset={disturbances.motionBlur ? [0.0035, 0.0028] : [0.0005, 0.0005]} />
          <Vignette eskil={false} offset={0.1} darkness={0.8} />
        </EffectComposer>
      </Canvas>
      <div className="lock-hud" aria-hidden>
        <div ref={hudRef} className={`lock-marker ${linkUp ? 'ok' : 'lost'}`}>
          <span className="lock-corner tl" />
          <span className="lock-corner tr" />
          <span className="lock-corner bl" />
          <span className="lock-corner br" />
          <span className="lock-dot" />
          <span className="lock-label">SEARCHING</span>
        </div>
        {decoys.map((d, i) => (
          <div
            key={d.id}
            ref={(el) => { decoyRefs.current[i] = el; }}
            className="lock-marker decoy"
          >
            <span className="lock-corner tl" />
            <span className="lock-corner tr" />
            <span className="lock-corner bl" />
            <span className="lock-corner br" />
            <span className="lock-label">REJECTED · {d.kind}</span>
          </div>
        ))}
      </div>
      {searching && (
        <div className="scan-ring">
          <div className="scan-ring-label">SCANNING FOV</div>
        </div>
      )}
      {showAcquired && (
        <div className="acquired-banner">ACQUIRED</div>
      )}
    </div>
  );
}
