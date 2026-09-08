import React, { useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

export default function UAVNode({ uav, isActive }) {
  const groupRef = useRef();
  const rotor1 = useRef();
  const rotor2 = useRef();
  const rotor3 = useRef();
  const rotor4 = useRef();
  const beaconRef = useRef();
  
  // Load drone texture as a sprite
  const droneTexture = useLoader(THREE.TextureLoader, '/drone.jpg');

  const stateColor = useMemo(() => {
    switch(uav.trackingState) {
      case 'LOCKED': return new THREE.Color('#ffffff');
      case 'TRACKING': return new THREE.Color('#00e676');
      case 'REACQUIRING': return new THREE.Color('#b39ddb');
      case 'ACQUIRING': return new THREE.Color('#ffb300');
      default: return new THREE.Color('#ff3333');
    }
  }, [uav.trackingState]);
  
  // Animate hovering + spinning rotors
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const idOffset = uav.id.charCodeAt(4);
    
    if (groupRef.current) {
      groupRef.current.position.set(
        uav.position[0],
        uav.position[1] + Math.sin(t * 2 + idOffset) * 8,
        uav.position[2]
      );
      // Gentle tilt based on movement
      groupRef.current.rotation.z = Math.sin(t * 0.5 + idOffset) * 0.05;
      groupRef.current.rotation.x = Math.cos(t * 0.3 + idOffset) * 0.05;
    }
    
    // Spin rotors
    const speed = 25;
    [rotor1, rotor2, rotor3, rotor4].forEach(r => {
      if (r.current) r.current.rotation.y += speed * 0.016;
    });
    
    // Pulse beacon
    if (beaconRef.current) {
      beaconRef.current.material.opacity = 0.5 + Math.sin(t * 4 + idOffset) * 0.5;
    }
  });

  const armLength = 18;
  const bodyScale = isActive ? 1.2 : 1;

  return (
    <group ref={groupRef}>
      {/* Central body - flat disc */}
      <mesh castShadow scale={[bodyScale, bodyScale, bodyScale]}>
        <cylinderGeometry args={[8, 10, 4, 8]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.3} />
      </mesh>
      
      {/* Camera gimbal underneath */}
      <mesh position={[0, -5, 0]}>
        <sphereGeometry args={[3, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Camera lens */}
      <mesh position={[0, -5, 3]} rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[2, 2, 1, 16]} />
        <meshStandardMaterial color="#111" metalness={1} roughness={0.1} />
      </mesh>
      
      {/* Arms */}
      {[
        [armLength, 2, armLength],
        [-armLength, 2, armLength],
        [armLength, 2, -armLength],
        [-armLength, 2, -armLength]
      ].map((pos, i) => (
        <group key={`arm-${i}`}>
          {/* Arm strut */}
          <mesh position={[pos[0]/2, pos[1], pos[2]/2]} 
                rotation={[0, Math.atan2(pos[2], pos[0]), 0]}>
            <boxGeometry args={[Math.sqrt(pos[0]*pos[0] + pos[2]*pos[2]), 1.5, 2]} />
            <meshStandardMaterial color="#333" metalness={0.7} roughness={0.4} />
          </mesh>
          
          {/* Motor housing */}
          <mesh position={pos}>
            <cylinderGeometry args={[3, 3, 4, 8]} />
            <meshStandardMaterial color="#222" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}
      
      {/* Spinning rotors (transparent discs) */}
      <mesh ref={rotor1} position={[armLength, 4, armLength]}>
        <cylinderGeometry args={[10, 10, 0.3, 3]} />
        <meshBasicMaterial color="#888" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={rotor2} position={[-armLength, 4, armLength]}>
        <cylinderGeometry args={[10, 10, 0.3, 3]} />
        <meshBasicMaterial color="#888" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={rotor3} position={[armLength, 4, -armLength]}>
        <cylinderGeometry args={[10, 10, 0.3, 3]} />
        <meshBasicMaterial color="#888" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={rotor4} position={[-armLength, 4, -armLength]}>
        <cylinderGeometry args={[10, 10, 0.3, 3]} />
        <meshBasicMaterial color="#888" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Navigation lights */}
      {/* Front-left: Green */}
      <mesh position={[armLength, 3, armLength]}>
        <sphereGeometry args={[1.5, 6, 6]} />
        <meshBasicMaterial color="#00ff44" toneMapped={false} />
      </mesh>
      {/* Front-right: Green */}
      <mesh position={[-armLength, 3, armLength]}>
        <sphereGeometry args={[1.5, 6, 6]} />
        <meshBasicMaterial color="#00ff44" toneMapped={false} />
      </mesh>
      {/* Rear-left: Red */}
      <mesh position={[armLength, 3, -armLength]}>
        <sphereGeometry args={[1.5, 6, 6]} />
        <meshBasicMaterial color="#ff2200" toneMapped={false} />
      </mesh>
      {/* Rear-right: Red */}
      <mesh position={[-armLength, 3, -armLength]}>
        <sphereGeometry args={[1.5, 6, 6]} />
        <meshBasicMaterial color="#ff2200" toneMapped={false} />
      </mesh>
      
      {/* Status beacon (bottom, pulsing) */}
      <mesh ref={beaconRef} position={[0, -9, 0]}>
        <sphereGeometry args={[2.5, 8, 8]} />
        <meshBasicMaterial color={stateColor} transparent opacity={1} toneMapped={false} />
      </mesh>
      
      {/* Status glow point light */}
      <pointLight 
        position={[0, -8, 0]} 
        color={stateColor} 
        intensity={isActive ? 2 : 0.5} 
        distance={100} 
      />
    </group>
  );
}
