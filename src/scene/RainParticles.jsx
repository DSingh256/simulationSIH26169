import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSimStore } from '../store/simStore';
import * as THREE from 'three';

export default function RainParticles({ count = 5500, spread = 4200, ceiling = 2800 }) {
  const pointsRef = useRef();
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * spread;
      arr[i * 3 + 1] = Math.random() * ceiling;
      arr[i * 3 + 2] = (Math.random() - 0.5) * spread;
    }
    return arr;
  }, [count, spread, ceiling]);

  useFrame((_, delta) => {
    const { simRunning, simPaused, simSpeed } = useSimStore.getState();
    if (!simRunning || simPaused || !pointsRef.current) return;
    const dt = Math.min(delta, 0.05) * simSpeed;
    const attr = pointsRef.current.geometry.attributes.position;
    const arr = attr.array;
    const fall = 720 * dt;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] -= fall * (0.75 + (i % 7) * 0.05);
      arr[i * 3] -= 40 * dt;
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3 + 1] = ceiling;
        arr[i * 3] = (Math.random() - 0.5) * spread;
        arr[i * 3 + 2] = (Math.random() - 0.5) * spread;
      }
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#9ec4e6"
        size={3.4}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
