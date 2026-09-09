import React, { useRef, useMemo } from 'react';
import { useSimStore } from '../store/simStore';
import { useFrame, useLoader } from '@react-three/fiber';
import { Line, Text, Sky, Billboard, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import UAVNode from './UAVNode';
import { tickTerminalSimulation } from '../sim/terminalSimulation';
// Textured Building component
function CityBuilding({ building, buildingTexture }) {
  const { x, z, width, depth, height } = building;
  
  // Create materials array for box faces - texture on sides, dark top/bottom
  const materials = useMemo(() => {
    const sideMat = new THREE.MeshStandardMaterial({
      map: buildingTexture.clone(),
      emissiveMap: buildingTexture.clone(),
      emissive: new THREE.Color('#ffcc88'),
      emissiveIntensity: 1.2,
      roughness: 0.3,
      metalness: 0.7,
    });
    // Scale texture based on building dimensions
    sideMat.map.wrapS = THREE.RepeatWrapping;
    sideMat.map.wrapT = THREE.RepeatWrapping;
    sideMat.map.repeat.set(width / 100, height / 150);
    sideMat.emissiveMap.wrapS = THREE.RepeatWrapping;
    sideMat.emissiveMap.wrapT = THREE.RepeatWrapping;
    sideMat.emissiveMap.repeat.set(width / 100, height / 150);
    
    const sideMat2 = sideMat.clone();
    sideMat2.map = buildingTexture.clone();
    sideMat2.emissiveMap = buildingTexture.clone();
    sideMat2.map.wrapS = THREE.RepeatWrapping;
    sideMat2.map.wrapT = THREE.RepeatWrapping;
    sideMat2.map.repeat.set(depth / 100, height / 150);
    sideMat2.emissiveMap.wrapS = THREE.RepeatWrapping;
    sideMat2.emissiveMap.wrapT = THREE.RepeatWrapping;
    sideMat2.emissiveMap.repeat.set(depth / 100, height / 150);
    
    const topMat = new THREE.MeshStandardMaterial({
      color: '#1a2530',
      emissive: new THREE.Color('#0a1520'),
      emissiveIntensity: 0.3,
      roughness: 0.8,
      metalness: 0.3,
    });
    
    return [
      sideMat,   // +x
      sideMat,   // -x
      topMat,    // +y (roof)
      topMat,    // -y (bottom)
      sideMat2,  // +z
      sideMat2,  // -z
    ];
  }, [buildingTexture, width, depth, height]);
  
  return (
    <mesh position={[x, height / 2, z]} material={materials} castShadow receiveShadow>
      <boxGeometry args={[width, height, depth]} />
    </mesh>
  );
}

// Rooftop light beacon
function RooftopBeacon({ position, height }) {
  const lightRef = useRef();
  
  useFrame(({ clock }) => {
    if (lightRef.current) {
      lightRef.current.material.opacity = 0.5 + Math.sin(clock.getElapsedTime() * 3) * 0.5;
    }
  });
  
  return (
    <mesh ref={lightRef} position={[position[0], height + 5, position[1]]}>
      <sphereGeometry args={[3, 8, 8]} />
      <meshBasicMaterial color="#ff2200" transparent opacity={1} toneMapped={false} />
    </mesh>
  );
}

export default function MissionWorld() {
  const store = useSimStore();
  const uavs = store.uavs.slice(0, store.numUAVs);
  const links = store.links;
  const numUAVs = store.numUAVs;
  const buildings = store.buildings;

  // Load textures
  const buildingTexture = useLoader(THREE.TextureLoader, '/building.jpg');
  const groundTexture = useLoader(THREE.TextureLoader, '/ground.jpg');
  
  // Configure ground texture tiling
  useMemo(() => {
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(12, 12);
  }, [groundTexture]);

  // Move UAVs around based on trajectory type
  useFrame(({ clock }) => {
    if (!store.simRunning || store.simPaused) return;
    
    const t = store.simTime;
    const dt = store.simSpeed * 0.016; // Approx 60fps step
    store.setSimTime(t + dt);
    
    for (let i = 0; i < numUAVs; i++) {
      const uav = uavs[i];
      let [x, y, z] = uav.position;
      
      const targetPos = uav.overrideActive && uav.overrideTarget ? uav.overrideTarget : uav.currentTarget;
      
      if (targetPos) {
        const dx = targetPos[0] - x;
        const dy = targetPos[1] - y;
        const dz = targetPos[2] - z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        if (!uav.overrideActive && dist < 50) {
          store.popWaypoint(i);
        } else if (dist > 1) {
          const moveSpeed = uav.speed * 20; // scale up to match scenario dimensions
          x += (dx / dist) * moveSpeed * dt;
          y += (dy / dist) * moveSpeed * dt;
          z += (dz / dist) * moveSpeed * dt;
          
          if (!uav.overrideActive) {
            // Small jitter on top of waypoint tracking
            x += Math.sin(t * 2.0 + i) * 15 * dt;
            y += Math.cos(t * 1.5 + i) * 5 * dt;
            z += Math.cos(t * 2.2 + i) * 15 * dt;
          }
        }
      }
      
      store.updateUAVPosition(i, [x, y, z], y);
    }
    
    // Update link line-of-sight occlusion
    store.updateLinksLOS();

    // ── Part 4: Tick dual-terminal simulation ──
    if (store.p4RunActive) {
      tickTerminalSimulation(store, dt);
    }
  });

  return (
    <>
      {/* Environment */}
      {store.environment !== 'NIGHT' && (
        <Sky 
          distance={45000} 
          sunPosition={[0, 1, 0]} 
          inclination={0} 
          azimuth={0.25} 
          turbidity={store.environment === 'CLEAR' ? 2 : 10} 
          rayleigh={store.environment === 'CLEAR' ? 1 : 3} 
        />
      )}
      
      {/* Lighting — dynamic based on weather */}
      <ambientLight intensity={store.environment === 'NIGHT' ? 0.2 : (store.envProfile?.lightIntensity || 1.0) * 0.8} />
      <directionalLight 
        position={[1000, 2000, 1000]} 
        intensity={store.environment === 'NIGHT' ? 0.1 : (store.envProfile?.lightIntensity || 1.0) * 2} 
        castShadow 
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      {/* Warm city glow from below */}
      <pointLight position={[0, 200, 0]} intensity={3} color="#ff9944" distance={8000} />
      <pointLight position={[500, 100, -500]} intensity={2} color="#cccccc" distance={4000} />
      <pointLight position={[-500, 100, 500]} intensity={2} color="#ff6633" distance={4000} />
      
      {/* Atmospheric fog — dynamically tied to environment profile */}
      <fog attach="fog" args={[
        store.environment === 'NIGHT' ? '#030305' : store.environment === 'OVERCAST' ? '#556677' : store.environment === 'CLOUDY_DYNAMIC' ? '#8899aa' : '#111111', 
        200, 
        store.envProfile?.visibilityRange || 8000
      ]} />

      {/* Ground plane with city texture */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[10000, 10000]} />
        <meshStandardMaterial 
          map={groundTexture}
          emissiveMap={groundTexture}
          emissive={new THREE.Color('#334455')}
          emissiveIntensity={0.4}
          roughness={0.9} 
          metalness={0.1}
        />
      </mesh>
      
      {/* 3D Cityscape Buildings with textures */}
      {buildings.map((b, i) => (
        <CityBuilding key={`b-${i}`} building={b} buildingTexture={buildingTexture} />
      ))}
      
      {/* Rooftop beacons on tall buildings */}
      {buildings.filter(b => b.height > 600).map((b, i) => (
        <RooftopBeacon key={`beacon-${i}`} position={[b.x, b.z]} height={b.height} />
      ))}
      
      {/* Atmospheric particles */}
      <Sparkles count={200} scale={[4000, 2000, 4000]} size={3} speed={0.3} opacity={0.15} color="#4488cc" />

      {/* UAVs and Labels */}
      {uavs.map((uav, i) => (
        <group key={uav.id}>
          <UAVNode uav={uav} isActive={i === 0 || i === 1} />
          <Billboard position={[uav.position[0], uav.position[1] + 45, uav.position[2]]}>
            <Text
              fontSize={20}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              outlineWidth={2}
              outlineColor="#000000"
              font={undefined}
            >
              {uav.id}
            </Text>
          </Billboard>
          <Billboard position={[uav.position[0], uav.position[1] + 25, uav.position[2]]}>
            <Text
              fontSize={14}
              color="#00b4d8"
              anchorX="center"
              anchorY="middle"
              outlineWidth={1}
              outlineColor="#000000"
              font={undefined}
            >
              Alt: {uav.altitude} m
            </Text>
          </Billboard>
        </group>
      ))}

      {/* Optical Links */}
      {links.map((link, idx) => {
        if (link.from >= numUAVs || link.to >= numUAVs) return null;
        
        const pos1 = uavs[link.from].position;
        const pos2 = uavs[link.to].position;
        
        // LOST = building is blocking the laser -> show broken red line
        if (link.state === 'LOST') {
          return (
            <Line
              key={`link-${link.from}-${link.to}`}
              points={[pos1, pos2]}
              color="#ff2222"
              lineWidth={1}
              dashed
              dashScale={30}
              dashSize={5}
              dashOffset={0}
              transparent
              opacity={0.25}
            />
          );
        }
        
        let color = '#333333';
        let lineWidth = 1;
        let opacity = 0.3;
        if (link.state === 'LOCKED') {
          color = '#ffffff';
          lineWidth = 2.5;
          opacity = 0.9;
        } else if (link.state === 'ACQUIRING') {
          color = '#ffb300';
          lineWidth = 1.5;
          opacity = 0.6;
        } else if (link.state === 'TRACKING') {
          color = '#00e676';
          lineWidth = 2;
          opacity = 0.8;
        }

        return (
          <Line
            key={`link-${link.from}-${link.to}`}
            points={[pos1, pos2]}
            color={color}
            lineWidth={lineWidth}
            dashed={link.state === 'ACQUIRING'}
            dashScale={50}
            dashSize={10}
            dashOffset={0}
            transparent
            opacity={opacity}
          />
        );
      })}
      {/* Part 4: Beam line between Terminal A and B when link is established */}
      {store.beamVisible && uavs.length >= 2 && (
        <Line
          points={[uavs[0].position, uavs[1].position]}
          color="#00ff88"
          lineWidth={4}
          transparent
          opacity={0.9}
        />
      )}
    </>
  );
}
