import { create } from 'zustand';
import {
  ENV_PRESETS,
  opticalAttenuation,
  createLinksForScenario,
  layoutPositions,
  linkBudget,
} from '../sim/simConfig';

export const TrackingState = {
  SEARCHING: 'SEARCHING',
  TRACKING: 'TRACKING',
  REACQUIRING: 'REACQUIRING',
  LOCKED: 'LOCKED',
  ACQUIRING: 'ACQUIRING',
};

function generateWaypoint(altitude = 1000, trajectoryType = 'MIXED') {
  const angle = Math.random() * Math.PI * 2;
  const radius = trajectoryType === 'LINEAR' ? 400 + Math.random() * 1600 : Math.random() * 1500;
  return [Math.cos(angle) * radius, altitude, Math.sin(angle) * radius];
}

function createUAV(id, idx, opts = {}) {
  const {
    altitude = 1000,
    speed = 30,
    scenario = 'MULTI_UAV_MESH',
    numUAVs = 6,
    trajectoryType = 'MIXED',
  } = opts;
  const layout = layoutPositions(numUAVs, scenario, altitude);
  const pos = layout[idx] || [
    Math.cos((idx / numUAVs) * Math.PI * 2) * 900,
    altitude,
    Math.sin((idx / numUAVs) * Math.PI * 2) * 900,
  ];
  const queue = [generateWaypoint(altitude, trajectoryType), generateWaypoint(altitude, trajectoryType), generateWaypoint(altitude, trajectoryType)];
  return {
    id,
    position: pos,
    altitude: Math.floor(pos[1]),
    speed,
    heading: Math.atan2(pos[2], pos[0]) + Math.PI / 2,
    orbitRadius: Math.hypot(pos[0], pos[2]) || 900,
    trackingState: ['TRACKING', 'LOCKED', 'ACQUIRING', 'TRACKING', 'LOCKED', 'TRACKING'][idx % 6],
    links: 0,
    battery: 60 + Math.floor(Math.random() * 30),
    linkMode: 'Auto',
    cameraFOV: 16.0,
    fps: 115 + Math.floor(Math.random() * 10),
    confidence: 0.9 + Math.random() * 0.08,
    pointingError: Math.random() * 2.5,
    detectionBox: null,
    waypointQueue: queue,
    currentTarget: queue[0],
    overrideActive: false,
    overrideTarget: null,
    lastKnownPosition: null,
    reacquireStartTime: 0,
    consecutiveLockFrames: 0,
  };
}

function createFleet(numUAVs, scenario, altitude, speed, trajectoryType) {
  return Array.from({ length: 6 }, (_, i) =>
    createUAV(`UAV-${i + 1}`, i, { altitude, speed, scenario, numUAVs, trajectoryType })
  );
}

function withLinkCounts(uavs, links, numUAVs) {
  const counts = Array(numUAVs).fill(0);
  links.forEach((l) => {
    if (l.from < numUAVs) counts[l.from]++;
    if (l.to < numUAVs) counts[l.to]++;
  });
  return uavs.map((u, i) => (i < numUAVs ? { ...u, links: counts[i] } : u));
}

function stamp(message, log) {
  const t = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const next = [...log, { time: t, message }];
  if (next.length > 50) next.splice(0, next.length - 50);
  return next;
}

// Ray-AABB intersection test: does the line segment from p1→p2 pass through the box [min, max]?
function rayIntersectAABB(p1, p2, min, max) {
  let tmin = 0.0;
  let tmax = 1.0;
  const d = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];

  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-6) {
      if (p1[i] < min[i] || p1[i] > max[i]) return false;
    } else {
      const ood = 1.0 / d[i];
      let t1 = (min[i] - p1[i]) * ood;
      let t2 = (max[i] - p1[i]) * ood;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return false;
    }
  }
  return true;
}

function createBuildings() {
  const buildings = [];
  for (let i = 0; i < 40; i++) {
    buildings.push({
      x: (Math.random() - 0.5) * 3000,
      z: (Math.random() - 0.5) * 3000,
      width: 100 + Math.random() * 200,
      depth: 100 + Math.random() * 200,
      height: 300 + Math.random() * 800,
    });
  }
  return buildings;
}

function createInitialLog() {
  const now = new Date();
  const fmt = (d) => d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entries = [];
  const messages = [
    'Simulation started',
    'UAV-1 initialized',
    'UAV-2 initialized',
    'UAV-3 initialized',
    'UAV-4 initialized',
    'UAV-5 initialized',
    'UAV-6 initialized',
    'Link established: UAV-1 ↔ UAV-2',
    'UAV-3 detected by FOV',
    'Coarse tracking engaged: UAV-3',
    'Turbulence intensity: 0.5',
    'Tracking originated: UAV-3',
  ];
  for (let i = 0; i < messages.length; i++) {
    const t = new Date(now.getTime() - (messages.length - i) * 3000);
    entries.push({ time: fmt(t), message: messages[i] });
  }
  return entries;
}

const INITIAL_DISTURBANCES = {
  atmosphericTurbulence: true,
  platformVibration: true,
  cameraMotion: true,
  imageNoise: true,
  motionBlur: true,
  temporaryOcclusion: false,
  weatherEffects: false,
};

function rebuildMission(state, overrides = {}) {
  const numUAVs = overrides.numUAVs ?? state.numUAVs;
  const scenario = overrides.scenario ?? state.scenario;
  const trajectoryType = overrides.trajectoryType ?? state.trajectoryType;
  const altitude = overrides.globalAltitude ?? state.globalAltitude;
  const speed = overrides.globalSpeed ?? state.globalSpeed;
  const links = createLinksForScenario(scenario, numUAVs);
  const uavs = withLinkCounts(
    createFleet(numUAVs, scenario, altitude, speed, trajectoryType),
    links,
    numUAVs
  );
  return { numUAVs, scenario, trajectoryType, globalAltitude: altitude, globalSpeed: speed, uavs, links, selectedLink: 0 };
}

export const useSimStore = create((set, get) => ({
  numUAVs: 6,
  environment: 'CLOUDY_DYNAMIC',
  scenario: 'MULTI_UAV_MESH',
  trajectoryType: 'MIXED',
  simRunning: true,
  simPaused: false,
  simSpeed: 1.0,
  simTime: 0,
  simSeed: 42,
  opticalAttenuationDbKm: opticalAttenuation('CLOUDY_DYNAMIC', false),

  fov: 16,
  zoom: 1,
  turbulenceStrength: 0.5,
  noiseStrength: 0.3,

  globalSpeed: 30,
  globalAltitude: 1000,

  ...(() => {
    const links = createLinksForScenario('MULTI_UAV_MESH', 6);
    return {
      uavs: withLinkCounts(createFleet(6, 'MULTI_UAV_MESH', 1000, 30, 'MIXED'), links, 6),
      links,
    };
  })(),
  buildings: createBuildings(),

  disturbances: { ...INITIAL_DISTURBANCES },
  occlusionTimer: 0,

  selectedLink: 0,

  trackingState: TrackingState.TRACKING,
  pointingError: { x: 0, y: 0 },
  cameraCorrection: { x: 0, y: 0 },
  detectionBox: null,
  detectionConfidence: 0,
  targetPosition: [0, 0, -1000],

  sunGlintActive: false,
  occlusionActive: false,
  lowLightActive: false,
  signalDropoutActive: false,

  metricsViewActive: false,

  patLatencies: {
    targetDetection: 0.8,
    multiTargetAssoc: 0.4,
    stateEstimation: 1.2,
    motionPrediction: 0.3,
    pointingControl: 0.5,
    cameraActuation: 0.6,
    coarseAlignment: 'Ready',
    fineAlignment: 'Ready',
  },

  sysPerf: {
    fps: 118,
    acqTime: 0.34,
    reacqTime: 0.48,
    avgTrackError: 1.9,
    maxTrackError: 6.4,
    lockRetention: 98.4,
    falseDetection: 0.7,
    inferenceTime: 1.3,
    controlLoop: 8.1,
  },

  trackingHistory: [],
  eventLog: createInitialLog(),

  setNumUAVs: (n) => set((state) => {
    const rebuilt = rebuildMission(state, { numUAVs: n });
    return { ...rebuilt, eventLog: stamp(`Fleet resized to ${n} nodes`, state.eventLog) };
  }),
  setEnvironment: (env) => set((state) => {
    const weather = state.disturbances.weatherEffects;
    const atten = opticalAttenuation(env, weather);
    return {
      environment: env,
      opticalAttenuationDbKm: atten,
      lowLightActive: env === 'NIGHT' || env === 'OVERCAST',
      eventLog: stamp(`Environment → ${ENV_PRESETS[env]?.label || env} (${atten.toFixed(2)} dB/km)`, state.eventLog),
    };
  }),
  setScenario: (s) => set((state) => {
    const rebuilt = rebuildMission(state, { scenario: s });
    return { ...rebuilt, eventLog: stamp(`Scenario → ${s.replace(/_/g, ' ')}`, state.eventLog) };
  }),
  setTrajectoryType: (t) => set((state) => {
    const rebuilt = rebuildMission(state, { trajectoryType: t });
    return { ...rebuilt, eventLog: stamp(`Trajectory → ${t.replace(/_/g, ' ')}`, state.eventLog) };
  }),
  setSimRunning: (r) => set((state) => ({
    simRunning: r,
    simPaused: r ? false : state.simPaused,
  })),
  setSimPaused: (p) => set({ simPaused: p }),
  togglePause: () => set((state) => {
    if (!state.simRunning) return { simRunning: true, simPaused: false };
    return { simPaused: !state.simPaused };
  }),
  stopSim: () => set({ simRunning: false, simPaused: false }),
  startSim: () => set({ simRunning: true, simPaused: false }),
  setSimSpeed: (s) => set({ simSpeed: s }),
  setSimTime: (t) => set({ simTime: t }),

  setGlobalSpeed: (v) => set((state) => {
    const uavs = state.uavs.map((u) => ({ ...u, speed: v }));
    return { globalSpeed: v, uavs };
  }),
  setGlobalAltitude: (v) => set((state) => {
    const uavs = state.uavs.map((u) => ({
      ...u,
      altitude: v,
      position: [u.position[0], v, u.position[2]],
      currentTarget: u.currentTarget ? [u.currentTarget[0], v, u.currentTarget[2]] : u.currentTarget,
      waypointQueue: (u.waypointQueue || []).map((w) => [w[0], v, w[2]]),
    }));
    return { globalAltitude: v, uavs };
  }),

  setDisturbance: (key, val) => set((state) => {
    const disturbances = { ...state.disturbances, [key]: val };
    const weather = disturbances.weatherEffects;
    const atten = opticalAttenuation(state.environment, weather);
    const turbulenceStrength = disturbances.atmosphericTurbulence ? 0.7 : 0.05;
    const noiseStrength = disturbances.imageNoise ? 0.45 : 0.04;
    let eventLog = stamp(`${val ? 'Enabled' : 'Disabled'} ${key}`, state.eventLog);
    if (key === 'weatherEffects') {
      eventLog = stamp(
        val
          ? `Weather ON — rain field + ${atten.toFixed(2)} dB/km link penalty`
          : `Weather OFF — attenuation ${atten.toFixed(2)} dB/km`,
        eventLog
      );
    }
    return {
      disturbances,
      opticalAttenuationDbKm: atten,
      turbulenceStrength,
      noiseStrength,
      occlusionActive: key === 'temporaryOcclusion' ? val && state.occlusionActive : (disturbances.temporaryOcclusion ? state.occlusionActive : false),
      eventLog,
    };
  }),

  setSelectedLink: (idx) => set({ selectedLink: idx }),

  setTargetPosition: (pos) => set({ targetPosition: pos }),
  setDetection: (uavIndex, box, confidence) => set((state) => {
    const uavs = [...state.uavs];
    if (uavs[uavIndex]) uavs[uavIndex] = { ...uavs[uavIndex], confidence, detectionBox: box };
    return { detectionBox: box, detectionConfidence: confidence, uavs };
  }),
  setTrackingState: (uavIndex, stateVal) => set((state) => {
    const uavs = [...state.uavs];
    if (uavs[uavIndex]) uavs[uavIndex] = { ...uavs[uavIndex], trackingState: stateVal };
    return { trackingState: stateVal, uavs };
  }),
  setMotionOverrideActive: (idx, active) => set((state) => {
    const uavs = [...state.uavs];
    if (uavs[idx]) uavs[idx] = { ...uavs[idx], overrideActive: active };
    return { uavs };
  }),
  setOverrideTarget: (idx, pos) => set((state) => {
    const uavs = [...state.uavs];
    if (uavs[idx]) uavs[idx] = { ...uavs[idx], overrideTarget: pos };
    return { uavs };
  }),
  setReacquireState: (idx, startTime, lastKnownPos) => set((state) => {
    const uavs = [...state.uavs];
    if (uavs[idx]) uavs[idx] = { ...uavs[idx], reacquireStartTime: startTime, lastKnownPosition: lastKnownPos, consecutiveLockFrames: 0 };
    return { uavs };
  }),
  incrementConsecutiveLockFrames: (idx) => set((state) => {
    const uavs = [...state.uavs];
    if (uavs[idx]) uavs[idx] = { ...uavs[idx], consecutiveLockFrames: (uavs[idx].consecutiveLockFrames || 0) + 1 };
    return { uavs };
  }),
  resetConsecutiveLockFrames: (idx) => set((state) => {
    const uavs = [...state.uavs];
    if (uavs[idx]) uavs[idx] = { ...uavs[idx], consecutiveLockFrames: 0 };
    return { uavs };
  }),
  popWaypoint: (idx) => set((state) => {
    const uavs = [...state.uavs];
    if (uavs[idx]) {
      const q = [...uavs[idx].waypointQueue];
      q.shift();
      q.push(generateWaypoint(state.globalAltitude, state.trajectoryType));
      uavs[idx] = { ...uavs[idx], waypointQueue: q, currentTarget: q[0] };
    }
    return { uavs };
  }),
  setPointingError: (uavIndex, err) => set((state) => {
    const uavs = [...state.uavs];
    const errMag = Math.sqrt(err.x * err.x + err.y * err.y) * 1000;
    if (uavs[uavIndex]) uavs[uavIndex] = { ...uavs[uavIndex], pointingError: errMag };
    return { pointingError: err, uavs };
  }),
  setCameraCorrection: (corr) => set({ cameraCorrection: corr }),
  setTurbulenceStrength: (val) => set({ turbulenceStrength: val }),
  setNoiseStrength: (val) => set({ noiseStrength: val }),
  setMetricsViewActive: (a) => set({ metricsViewActive: a }),

  triggerFailure: (type, duration = 3000) => {
    set({ [type]: true });
    if (duration > 0) setTimeout(() => set({ [type]: false }), duration);
  },

  updateUAVPosition: (idx, pos, alt) => set((state) => {
    const uavs = [...state.uavs];
    uavs[idx] = { ...uavs[idx], position: pos, altitude: Math.floor(alt) };
    return { uavs };
  }),

  updateLinksLOS: () => {},

  updateLink: (idx, data) => set((state) => {
    const links = [...state.links];
    links[idx] = { ...links[idx], ...data };
    return { links };
  }),

  addEvent: (message) => set((state) => ({ eventLog: stamp(message, state.eventLog) })),

  addTrackingPoint: (point) => set((state) => {
    const hist = [...state.trackingHistory, point];
    if (hist.length > 250) hist.shift();
    return { trackingHistory: hist };
  }),

  /**
   * Single batched tick: clock, UAV flight dynamics, optical budget, LOS, telemetry.
   * `rawDelta` is the R3F frame delta in seconds.
   */
  stepPhysics: (rawDelta) => set((state) => {
    if (!state.simRunning || state.simPaused) return {};

    const dt = Math.min(Math.max(rawDelta, 0), 0.05) * state.simSpeed;
    if (dt <= 0) return {};

    const simTime = state.simTime + dt;
    const { disturbances, buildings, numUAVs, trajectoryType, globalAltitude, globalSpeed } = state;
    const weatherOn = disturbances.weatherEffects;
    const atten = opticalAttenuation(state.environment, weatherOn);
    const logEntries = [];

    const uavs = state.uavs.map((u) => ({ ...u, position: [...u.position], waypointQueue: [...(u.waypointQueue || [])] }));

    for (let i = 0; i < numUAVs; i++) {
      const uav = uavs[i];
      let [x, y, z] = uav.position;
      const speed = (uav.speed || globalSpeed);

      if (uav.overrideActive && uav.overrideTarget) {
        const dx = uav.overrideTarget[0] - x;
        const dy = uav.overrideTarget[1] - y;
        const dz = uav.overrideTarget[2] - z;
        const dist = Math.hypot(dx, dy, dz) || 1;
        const step = speed * 18 * dt;
        x += (dx / dist) * step;
        y += (dy / dist) * step;
        z += (dz / dist) * step;
      } else if (trajectoryType === 'CIRCULAR') {
        const r = uav.orbitRadius || 900;
        const omega = speed / Math.max(r, 80);
        const heading = (uav.heading || 0) + omega * dt;
        uav.heading = heading;
        x = Math.cos(heading) * r;
        z = Math.sin(heading) * r;
        y += (globalAltitude - y) * Math.min(1, 1.8 * dt);
      } else if (trajectoryType === 'LINEAR') {
        let heading = uav.heading || 0;
        x += Math.cos(heading) * speed * 16 * dt;
        z += Math.sin(heading) * speed * 16 * dt;
        if (Math.abs(x) > 1800 || Math.abs(z) > 1800) {
          heading += Math.PI * 0.7;
          uav.heading = heading;
        }
        y += (globalAltitude - y) * Math.min(1, 1.8 * dt);
      } else {
        const targetPos = uav.currentTarget;
        if (targetPos) {
          const dx = targetPos[0] - x;
          const dz = targetPos[2] - z;
          const dy = globalAltitude - y;
          const dist = Math.hypot(dx, dy, dz);
          if (dist < 60) {
            const q = [...uav.waypointQueue];
            q.shift();
            q.push(generateWaypoint(globalAltitude, trajectoryType));
            uav.waypointQueue = q;
            uav.currentTarget = q[0];
          } else if (dist > 1) {
            const moveSpeed = speed * 20;
            x += (dx / dist) * moveSpeed * dt;
            y += (dy / dist) * moveSpeed * dt;
            z += (dz / dist) * moveSpeed * dt;
          }
        }
      }

      if (disturbances.atmosphericTurbulence) {
        x += Math.sin(simTime * 3.1 + i) * 22 * dt;
        z += Math.cos(simTime * 2.7 + i * 1.3) * 22 * dt;
        y += Math.sin(simTime * 4.2 + i) * 10 * dt;
      }
      if (disturbances.platformVibration) {
        x += (Math.random() - 0.5) * 6 * dt * 60;
        y += (Math.random() - 0.5) * 4 * dt * 60;
        z += (Math.random() - 0.5) * 6 * dt * 60;
      }

      y = Math.max(80, y);
      uav.position = [x, y, z];
      uav.altitude = Math.floor(y);
      uav.speed = speed;
    }

    let occlusionActive = state.occlusionActive;
    let occlusionTimer = state.occlusionTimer || 0;
    if (disturbances.temporaryOcclusion) {
      occlusionTimer -= dt;
      if (occlusionTimer <= 0) {
        occlusionActive = !occlusionActive;
        occlusionTimer = occlusionActive ? 1.2 + Math.random() * 2.2 : 3 + Math.random() * 5;
        logEntries.push(occlusionActive ? 'Occlusion burst — FOV obstructed' : 'Occlusion cleared');
      }
    } else {
      occlusionActive = false;
      occlusionTimer = 0;
    }

    const newLinks = state.links.map((link) => ({ ...link }));
    let avgErr = 0;
    let maxErr = 0;
    let locked = 0;

    for (let i = 0; i < newLinks.length; i++) {
      const link = newLinks[i];
      if (link.from >= numUAVs || link.to >= numUAVs) continue;
      const p1 = uavs[link.from].position;
      const p2 = uavs[link.to].position;
      const distM = Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]);

      let occluded = false;
      for (const b of buildings) {
        const bmin = [b.x - b.width / 2, 0, b.z - b.depth / 2];
        const bmax = [b.x + b.width / 2, b.height, b.z + b.depth / 2];
        if (rayIntersectAABB(p1, p2, bmin, bmax)) {
          occluded = true;
          break;
        }
      }
      if (disturbances.temporaryOcclusion && occlusionActive && i === 0) occluded = true;

      let basePointing = 0.6 + Math.sin(simTime * 1.7 + i) * 0.35;
      if (disturbances.atmosphericTurbulence) basePointing += 1.4 + Math.random() * 2.2;
      if (disturbances.platformVibration) basePointing += 0.8 + Math.random() * 1.4;
      if (disturbances.cameraMotion) basePointing += 0.4;
      if (weatherOn) basePointing += 1.1;

      const budget = linkBudget({
        distM,
        attenuationDbKm: atten,
        weatherOn,
        pointingUrad: basePointing,
        turbulence: disturbances.atmosphericTurbulence,
        vibration: disturbances.platformVibration,
      });

      let next = {
        ...link,
        distance: budget.distKm,
        angularError: basePointing,
        predictedError: basePointing * 0.78,
        receivedPower: budget.receivedPower,
        linkMargin: budget.linkMargin,
      };

      if (occluded && link.losClear) {
        next = { ...next, losClear: false, state: 'LOST', confidence: 0 };
        logEntries.push(`Link UAV-${link.from + 1}↔UAV-${link.to + 1} LOST — obstruction`);
      } else if (!occluded && !link.losClear) {
        next = { ...next, losClear: true, state: 'ACQUIRING', confidence: 0.3 };
        logEntries.push(`Link UAV-${link.from + 1}↔UAV-${link.to + 1} re-acquiring — LOS clear`);
      } else if (!occluded && link.state === 'ACQUIRING') {
        const newConf = link.confidence + 0.35 * dt;
        if (newConf >= 0.9) {
          next = { ...next, state: 'LOCKED', confidence: 0.95 };
          logEntries.push(`Link UAV-${link.from + 1}↔UAV-${link.to + 1} LOCKED`);
        } else {
          next = { ...next, confidence: newConf };
        }
      } else if (!occluded && (link.state === 'LOCKED' || link.state === 'TRACKING')) {
        if (budget.linkMargin < 1.5) {
          next = { ...next, state: 'ACQUIRING', confidence: Math.max(0.35, link.confidence - 0.2) };
          logEntries.push(`Link UAV-${link.from + 1}↔UAV-${link.to + 1} fading — low margin`);
        } else {
          next = { ...next, state: 'LOCKED', confidence: Math.min(0.99, 0.88 + budget.linkMargin / 40) };
        }
      }

      avgErr += next.angularError;
      maxErr = Math.max(maxErr, next.angularError);
      if (next.state === 'LOCKED') locked++;
      newLinks[i] = next;
    }

    const linkN = Math.max(newLinks.length, 1);
    avgErr /= linkN;

    const history = [...state.trackingHistory];
    history.push({
      time: simTime.toFixed(1),
      actual: avgErr,
      predicted: avgErr * 0.8,
    });
    if (history.length > 80) history.shift();

    const weatherLatency = weatherOn ? 0.35 : 0;
    const turbLatency = disturbances.atmosphericTurbulence ? 0.2 : 0;
    const patLatencies = {
      ...state.patLatencies,
      targetDetection: 0.7 + Math.random() * 0.3 + weatherLatency,
      multiTargetAssoc: 0.35 + Math.random() * 0.15,
      stateEstimation: 1.05 + Math.random() * 0.3 + turbLatency,
      motionPrediction: 0.25 + Math.random() * 0.12,
      pointingControl: 0.45 + Math.random() * 0.2 + (disturbances.platformVibration ? 0.25 : 0),
      cameraActuation: 0.5 + Math.random() * 0.2 + (disturbances.cameraMotion ? 0.2 : 0),
      coarseAlignment: occlusionActive ? 'Hold' : 'Ready',
      fineAlignment: newLinks[0]?.state === 'LOCKED' ? 'Locked' : 'Seek',
    };

    const lockRetention = (locked / linkN) * 100;
    const sysPerf = {
      fps: Math.round(1 / Math.max(rawDelta, 1 / 120)),
      acqTime: +(0.28 + (weatherOn ? 0.18 : 0) + (occlusionActive ? 0.22 : 0)).toFixed(2),
      reacqTime: +(0.4 + (weatherOn ? 0.25 : 0) + atten * 0.04).toFixed(2),
      avgTrackError: +avgErr.toFixed(2),
      maxTrackError: +maxErr.toFixed(2),
      lockRetention: +lockRetention.toFixed(1),
      falseDetection: +(0.4 + (disturbances.imageNoise ? 0.5 : 0) + (weatherOn ? 0.4 : 0)).toFixed(1),
      inferenceTime: +(1.1 + Math.random() * 0.4).toFixed(1),
      controlLoop: +(7.6 + (disturbances.platformVibration ? 1.4 : 0) + state.simSpeed * 0.2).toFixed(1),
    };

    let eventLog = state.eventLog;
    if (logEntries.length) {
      logEntries.forEach((msg) => { eventLog = stamp(msg, eventLog); });
    }

    return {
      simTime,
      uavs: withLinkCounts(uavs, newLinks, numUAVs),
      links: newLinks,
      trackingHistory: history,
      opticalAttenuationDbKm: atten,
      occlusionActive,
      occlusionTimer,
      patLatencies,
      sysPerf,
      eventLog,
    };
  }),

  resetSim: () => set((state) => {
    const rebuilt = rebuildMission(state);
    return {
      ...rebuilt,
      simTime: 0,
      simRunning: false,
      simPaused: false,
      trackingHistory: [],
      occlusionActive: false,
      occlusionTimer: 0,
      cameraCorrection: { x: 0, y: 0 },
      pointingError: { x: 0, y: 0 },
      opticalAttenuationDbKm: opticalAttenuation(state.environment, state.disturbances.weatherEffects),
      eventLog: stamp('Simulation reset', createInitialLog()),
    };
  }),
}));
