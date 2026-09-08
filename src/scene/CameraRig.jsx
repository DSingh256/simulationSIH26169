import React from 'react';
import { PerspectiveCamera, OrbitControls } from '@react-three/drei';

export default function CameraRig() {
  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[0, 1500, 2500]}
        fov={45}
        near={10}
        far={20000}
      />
      <OrbitControls 
        target={[0, 500, 0]}
        maxPolarAngle={Math.PI / 2 - 0.05} // Don't go below ground
        minDistance={500}
        maxDistance={8000}
      />
    </>
  );
}
