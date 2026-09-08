import React, { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useSimStore } from '../store/simStore';
import { detectBlob } from './detector';
import { updateStateMachine } from './stateMachine';
import { PIDController } from './pid';
import { loadCNNClassifier, classifyCandidates } from './cnnClassifier';

export default function TrackerController({ uavIndex = 0 }) {
  const { gl, size } = useThree();
  const workerRef = useRef(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  
  const setDetection = useSimStore(state => state.setDetection);
  const setTrackingState = useSimStore(state => state.setTrackingState);
  const setPointingError = useSimStore(state => state.setPointingError);
  const setCameraCorrection = useSimStore(state => state.setCameraCorrection);
  
  // PID gains for coarse tracking mount
  const pidX = useRef(new PIDController(0.2, 0.01, 0.1));
  const pidY = useRef(new PIDController(0.2, 0.01, 0.1));

  const frameCounter = useRef(0);

  useEffect(() => {
    loadCNNClassifier().then(() => setModelLoaded(true));
    
    workerRef.current = new Worker(new URL('./kalman.worker.js', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (e) => {
      const { type, data } = e.data;
      if (type === 'FILTERED_POSITION') {
        const { x, y, width, height, confidence, framesSinceLastLock } = data;
        const storeState = useSimStore.getState();
        const uav = storeState.uavs[uavIndex];
        
        if (confidence > 0) {
          setDetection(uavIndex, { x, y, width, height }, confidence);
          if (confidence > 0.7) {
            storeState.incrementConsecutiveLockFrames(uavIndex);
          } else {
            storeState.resetConsecutiveLockFrames(uavIndex);
          }
        } else {
          setDetection(uavIndex, null, 0);
          storeState.resetConsecutiveLockFrames(uavIndex);
        }
        
        // Calculate error from center of screen
        const errX = (x - size.width / 2) / size.width;
        const errY = (y - size.height / 2) / size.height;
        setPointingError(uavIndex, { x: errX, y: errY });
        
        let nextState = uav.trackingState;
        
        // State Machine Override Logic
        if (nextState === 'TRACKING' || nextState === 'LOCKED') {
          if (confidence < 0.3) {
            nextState = 'REACQUIRING';
            // Latch current physical target position (from targetUav)
            if (targetUav) {
              storeState.setReacquireState(uavIndex, storeState.simTime, [...targetUav.position]);
            }
            storeState.setMotionOverrideActive(uavIndex, true);
            storeState.addEvent(`UAV-${uav.id} lock lost — returning to last position`);
          }
        } else if (nextState === 'REACQUIRING') {
          const simTime = storeState.simTime;
          if (confidence > 0.7 && uav.consecutiveLockFrames > 10) {
            nextState = 'TRACKING';
            storeState.setMotionOverrideActive(uavIndex, false);
            storeState.addEvent(`UAV-${uav.id} reacquired — resuming trajectory`);
          } else if (simTime - uav.reacquireStartTime > 5) { // 5 seconds timeout
            nextState = 'SEARCHING';
            storeState.addEvent(`UAV-${uav.id} reacquire timeout — SEARCH mode`);
          } else {
            // Apply steer/spiral
            if (uav.lastKnownPosition) {
              const dx = uav.lastKnownPosition[0] - uav.position[0];
              const dy = uav.lastKnownPosition[1] - uav.position[1];
              const dz = uav.lastKnownPosition[2] - uav.position[2];
              const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
              
              if (dist > 50) {
                // Steer toward last known
                storeState.setOverrideTarget(uavIndex, uav.lastKnownPosition);
              } else {
                // Spiral scan
                const t = simTime - uav.reacquireStartTime;
                const radius = t * 30; // expanding radius
                const angle = t * 5; // spiral speed
                storeState.setOverrideTarget(uavIndex, [
                  uav.lastKnownPosition[0] + Math.cos(angle) * radius,
                  uav.lastKnownPosition[1],
                  uav.lastKnownPosition[2] + Math.sin(angle) * radius
                ]);
              }
            }
          }
        } else if (nextState === 'SEARCHING') {
          if (confidence > 0.8) {
            nextState = 'TRACKING';
          }
        }
        
        if (nextState !== uav.trackingState) {
          setTrackingState(uavIndex, nextState);
          if (nextState === 'SEARCHING') {
            pidX.current.reset();
            pidY.current.reset();
          }
        }
        
        if (nextState === 'TRACKING' || nextState === 'LOCKED' || nextState === 'REACQUIRING') {
          // PID update -> angular correction
          const corrX = pidX.current.update(errX, 1/15);
          const corrY = pidY.current.update(errY, 1/15);
          
          const currentCorrection = useSimStore.getState().cameraCorrection;
          setCameraCorrection({
            x: currentCorrection.x + corrX,
            y: currentCorrection.y - corrY // invert Y for pitch
          });
        }
      }
    };

    return () => workerRef.current?.terminate();
  }, [size, setDetection, setPointingError, setTrackingState, setCameraCorrection]);

  useFrame(async (state) => {
    frameCounter.current++;
    if (frameCounter.current % 4 !== 0) return; // ~15 FPS
    if (!modelLoaded) return;
    
    const pixelRatio = gl.getPixelRatio();
    const physWidth = Math.floor(size.width * pixelRatio);
    const physHeight = Math.floor(size.height * pixelRatio);
    
    const candidates = detectBlob(gl, physWidth, physHeight, pixelRatio);
    
    // CNN Filter
    const validCandidates = await classifyCandidates(candidates, gl, physWidth, physHeight, pixelRatio);
    
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'PROCESS_DETECTION',
        data: { candidates: validCandidates }
      });
    }
  });

  return null;
}
