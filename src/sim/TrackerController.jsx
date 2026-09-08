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
        
        if (confidence > 0) {
          setDetection(uavIndex, { x, y, width, height }, confidence);
        } else {
          setDetection(uavIndex, null, 0);
        }
        
        // Calculate error from center of screen
        const errX = (x - size.width / 2) / size.width;
        const errY = (y - size.height / 2) / size.height;
        setPointingError(uavIndex, { x: errX, y: errY });
        
        const nextState = updateStateMachine(useSimStore.getState().uavs[uavIndex].trackingState, confidence, framesSinceLastLock);
        if (nextState !== useSimStore.getState().uavs[uavIndex].trackingState) {
          setTrackingState(uavIndex, nextState);
          if (nextState === 'SEARCHING') {
            pidX.current.reset();
            pidY.current.reset();
          }
        }
        
        if (nextState === 'TRACKING') {
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
