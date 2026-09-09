import React, { useRef, useMemo } from 'react';
import { useSimStore } from '../store/simStore';
import { ENV_PRESETS } from '../sim/simConfig';
import { useFrame, useLoader } from '@react-three/fiber';
import { Line, Text, Sky, Billboard, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import UAVNode from './UAVNode';
import RainParticles from './RainParticles';

function CityBuilding({ building, buildingTexture, night }) {
  const { x, z, width, depth, height } = building;

  const materials = useMemo(() => {
    const sideMat = new THREE.MeshStandardMaterial({
      map: buildingTexture.clone(),
      emissiveMap: buildingTexture.clone(),
      emissive: new THREE.Color(night ? '#ffcc88' : '#665544'),
      emissiveIntensity: night ? 1.35 : 0.35,
      roughness: 0.3,
      metalness: 0.7,
    });
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

    return [sideMat, sideMat, topMat, topMat, sideMat2, sideMat2];
  }, [buildingTexture, width, depth, height, night]);

  return (
    <mesh position={[x, height / 2, z]} material={materials} castShadow receiveShadow>
      <boxGeometry args={[width, height, depth]} />
    </mesh>
  );
}

function RooftopBeacon({ position, height }) {
  const lightRef = useRef();

  useFrame(({ clock }) => {
    const { simRunning, simPaused, simSpeed } = useSimStore.getState();
    if (!lightRef.current) return;
    const t = simRunning && !simPaused ? clock.getElapsedTime() * simSpeed : clock.getElapsedTime();
    lightRef.current.material.opacity = 0.5 + Math.sin(t * 3) * 0.5;
  });

  return (
    <mesh ref={lightRef} position={[position[0], height + 5, position[1]]}>
      <sphereGeometry args={[3, 8, 8]} />
      <meshBasicMaterial color="#ff2200" transparent opacity={1} toneMapped={false} />
    </mesh>
  );
}

export default function MissionWorld() {
  const uavsAll = useSimStore((s) => s.uavs);
  const links = useSimStore((s) => s.links);
  const numUAVs = useSimStore((s) => s.numUAVs);
  const buildings = useSimStore((s) => s.buildings);
  const environment = useSimStore((s) => s.environment);
  const weatherOn = useSimStore((s) => s.disturbances.weatherEffects);
  const env = ENV_PRESETS[environment] || ENV_PRESETS.CLOUDY_DYNAMIC;

  const uavs = uavsAll.slice(0, numUAVs);

  const buildingTexture = useLoader(THREE.TextureLoader, '/building.jpg');
  const groundTexture = useLoader(THREE.TextureLoader, '/ground.jpg');

  useMemo(() => {
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(12, 12);
  }, [groundTexture]);

  useFrame((_, delta) => {
    useSimStore.getState().stepPhysics(delta);
  });

  const fogNear = weatherOn ? env.fogNear * 0.55 : env.fogNear;
  const fogFar = weatherOn ? env.fogFar * 0.7 : env.fogFar;

  return (
    <>
      <color attach="background" args={[env.bg]} />
      {environment !== 'NIGHT' && (
        <Sky
          distance={45000}
          sunPosition={env.sunPosition}
          inclination={0}
          azimuth={0.25}
          turbidity={env.turbidity}
          rayleigh={env.rayleigh}
        />
      )}

      <ambientLight intensity={env.ambient * (weatherOn ? 0.7 : 1)} />
      <directionalLight
        position={env.sunPosition}
        intensity={env.sun * (weatherOn ? 0.55 : 1)}
        color={environment === 'NIGHT' ? '#8899cc' : weatherOn ? '#99aabb' : '#fff4e0'}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[0, 200, 0]} intensity={env.cityGlow} color="#ff9944" distance={8000} />
      <pointLight position={[500, 100, -500]} intensity={env.cityGlow * 0.6} color="#cccccc" distance={4000} />
      <pointLight position={[-500, 100, 500]} intensity={env.cityGlow * 0.7} color="#ff6633" distance={4000} />

      <fog attach="fog" args={[env.fogColor, fogNear, fogFar]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[10000, 10000]} />
        <meshStandardMaterial
          map={groundTexture}
          emissiveMap={groundTexture}
          emissive={new THREE.Color(environment === 'NIGHT' ? '#223344' : '#334455')}
          emissiveIntensity={environment === 'NIGHT' ? 0.55 : 0.35}
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>

      {buildings.map((b, i) => (
        <CityBuilding key={`b-${i}`} building={b} buildingTexture={buildingTexture} night={environment === 'NIGHT'} />
      ))}

      {buildings.filter((b) => b.height > 600).map((b, i) => (
        <RooftopBeacon key={`beacon-${i}`} position={[b.x, b.z]} height={b.height} />
      ))}

      <Sparkles
        count={weatherOn ? 80 : environment === 'CLEAR' ? 40 : 200}
        scale={[4000, 2000, 4000]}
        size={3}
        speed={0.3}
        opacity={environment === 'NIGHT' ? 0.35 : 0.12}
        color={environment === 'NIGHT' ? '#ccd8ff' : '#4488cc'}
      />

      {weatherOn && <RainParticles />}

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
            >
              Alt: {uav.altitude} m
            </Text>
          </Billboard>
        </group>
      ))}

      {links.map((link) => {
        if (link.from >= numUAVs || link.to >= numUAVs) return null;
        const pos1 = uavs[link.from]?.position;
        const pos2 = uavs[link.to]?.position;
        if (!pos1 || !pos2) return null;

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
              transparent
              opacity={0.25}
            />
          );
        }

        let color = '#333333';
        let lineWidth = 1;
        let opacity = 0.3;
        if (link.state === 'LOCKED') {
          color = weatherOn ? '#88ccee' : '#ffffff';
          lineWidth = 2.5;
          opacity = weatherOn ? 0.55 : 0.9;
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
            transparent
            opacity={opacity}
          />
        );
      })}
    </>
  );
}
