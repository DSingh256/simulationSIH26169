import { create } from 'zustand';
import { getSimRNG, resetSimRNG } from '../sim/seededRandom';

export const TrackingState = {
  SEARCHING: 'SEARCHING',
  TRACKING: 'TRACKING',
  REACQUIRING: 'REACQUIRING',
  LOCKED: 'LOCKED',
  ACQUIRING: 'ACQUIRING',
};

// ─── Part 4: Terminal Phase Enum ───
export const TerminalPhase = {
  DEPLOYED: 'DEPLOYED',
  SEARCHING: 'SEARCHING',
  LINK_ESTABLISHING: 'LINK_ESTABLISHING',
  COARSE_TRACK: 'COARSE_TRACK',
  REACQUIRE: 'REACQUIRE',
};

// ─── Part 4: Scenario Labels ───
export const ScenarioLabel = {
  BASELINE: 'baseline',
  TURBULENCE: 'turbulence',
  OCCLUSION: 'occlusion',
  SUN_GLINT: 'sun-glint',
  DROPOUT: 'dropout',
  COMBINED: 'combined',
};

// ─── Part 4: Detector Modes ───
export const DetectorMode = {
  BLOB_ONLY: 'blob_only',
  BLOB_CNN: 'blob+CNN',
};

function createTerminalState(id) {
  return {
    id,
    phase: TerminalPhase.DEPLOYED,
    confirmedLock: false,
    searchStartTime: 0,
    searchProgress: 0,
    searchYaw: 0,
    searchPitch: 0,
    gimbalYaw: 0,
    gimbalPitch: 0,
    detectionResult: null,
    rawCandidateCount: 0,
    confirmedCandidateCount: 0,
    rejectedCandidateCount: 0,
    cnnConfidence: 0,
    trackingErrors: [],
    reacquireCount: 0,
    reacquireTimes: [],
    reacquireStartT: 0,
    lockStartT: 0,
    consecutiveLockFrames: 0,
  };
}

// ─── Waypoint generation respects altitude ───
function generateWaypoint(altitude = 1000, scenario = 'MULTI_UAV_MESH', trajectoryType = 'MIXED', index = 0) {
  const alt = altitude;

  if (scenario === 'POINT_TO_POINT') {
    // Fly back and forth along a line
    const side = Math.random() > 0.5 ? 1 : -1;
    return [side * (800 + Math.random() * 400), alt, (Math.random() - 0.5) * 200];
  } else if (scenario === 'RELAY_CHAIN') {
    // Lined up evenly spaced along X axis
    const slotX = (index - 3) * 600 + (Math.random() - 0.5) * 200;
    return [slotX, alt, (Math.random() - 0.5) * 300];
  } else if (scenario === 'STAR_TOPOLOGY') {
    // Index 0 hovers near center, others orbit around
    if (index === 0) {
      return [(Math.random() - 0.5) * 100, alt, (Math.random() - 0.5) * 100];
    }
    const angle = (index / 5) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const radius = 700 + Math.random() * 300;
    return [Math.cos(angle) * radius, alt, Math.sin(angle) * radius];
  }

  // MULTI_UAV_MESH / default
  let tType = trajectoryType;
  if (tType === 'MIXED') {
    tType = ['LINEAR', 'CIRCULAR', 'RANDOM_WALK'][Math.floor(Math.random() * 3)];
  }
  
  if (tType === 'LINEAR') {
    const side = Math.random() > 0.5 ? 1 : -1;
    return [side * (500 + Math.random() * 1000), alt, (Math.random() - 0.5) * 2000];
  } else if (tType === 'CIRCULAR') {
    const angle = Math.random() * Math.PI * 2;
    const radius = 600 + Math.random() * 800;
    return [Math.cos(angle) * radius, alt, Math.sin(angle) * radius];
  } else {
    // RANDOM_WALK
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 1500;
    return [Math.cos(angle) * radius, alt, Math.sin(angle) * radius];
  }
}

// Generate initial UAV data
function createUAV(id, idx, altitude = 1000, scenario = 'MULTI_UAV_MESH', trajectoryType = 'MIXED') {
  let pos;
  if (scenario === 'RELAY_CHAIN') {
    pos = [(idx - 3) * 600, altitude, 0];
  } else if (scenario === 'STAR_TOPOLOGY') {
    if (idx === 0) {
      pos = [0, altitude, 0];
    } else {
      const angle = (idx / 5) * Math.PI * 2;
      pos = [Math.cos(angle) * 800, altitude, Math.sin(angle) * 800];
    }
  } else if (scenario === 'POINT_TO_POINT') {
    const side = idx % 2 === 0 ? -1 : 1;
    pos = [side * (600 + Math.random() * 200), altitude, (idx - 3) * 200];
  } else {
    // MULTI_UAV_MESH
    const angle = (idx / 6) * Math.PI * 2;
    const radius = 800 + Math.random() * 400;
    pos = [Math.cos(angle) * radius, altitude, Math.sin(angle) * radius];
  }

  const queue = [
    generateWaypoint(altitude, scenario, trajectoryType, idx),
    generateWaypoint(altitude, scenario, trajectoryType, idx),
    generateWaypoint(altitude, scenario, trajectoryType, idx),
  ];

  return {
    id,
    position: pos,
    altitude: Math.floor(pos[1]),
    speed: 25 + Math.floor(Math.random() * 10),
    trackingState: ['TRACKING', 'LOCKED', 'ACQUIRING', 'TRACKING', 'LOCKED', 'TRACKING'][idx],
    links: Math.floor(Math.random() * 3) + 1,
    battery: 60 + Math.floor(Math.random() * 30),
    linkMode: 'Auto',
    cameraFOV: 3.0,
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

function createInitialLinks(numUAVs, scenario = 'MULTI_UAV_MESH') {
  const links = [];

  if (scenario === 'POINT_TO_POINT') {
    // Only adjacent pairs
    for (let i = 0; i < numUAVs - 1; i += 2) {
      if (i + 1 < numUAVs) {
        links.push(createLink(i, i + 1));
      }
    }
    // If odd, connect last to first pair
    if (numUAVs % 2 !== 0 && numUAVs > 1) {
      links.push(createLink(numUAVs - 1, 0));
    }
  } else if (scenario === 'RELAY_CHAIN') {
    // Chain: 0→1→2→3→...
    for (let i = 0; i < numUAVs - 1; i++) {
      links.push(createLink(i, i + 1));
    }
  } else if (scenario === 'STAR_TOPOLOGY') {
    // Index 0 is hub, all others connect to it
    for (let i = 1; i < numUAVs; i++) {
      links.push(createLink(0, i));
    }
  } else {
    // MULTI_UAV_MESH: ring topology
    for (let i = 0; i < numUAVs; i++) {
      const j = (i + 1) % numUAVs;
      links.push(createLink(i, j));
    }
  }
  return links;
}

function createLink(from, to) {
  return {
    from, to,
    state: 'LOCKED',
    distance: 1.5 + Math.random() * 2,
    angularError: Math.random() * 1.5,
    predictedError: Math.random() * 0.5,
    confidence: 0.85 + Math.random() * 0.13,
    receivedPower: -30 + Math.random() * 5,
    linkMargin: 4 + Math.random() * 4,
    losClear: true
  };
}

function createBuildings() {
  const buildings = [];
  for (let i = 0; i < 40; i++) {
    buildings.push({
      x: (Math.random() - 0.5) * 3000,
      z: (Math.random() - 0.5) * 3000,
      width: 100 + Math.random() * 200,
      depth: 100 + Math.random() * 200,
      height: 300 + Math.random() * 800
    });
  }
  return buildings;
}

// Ray-AABB intersection test
function rayIntersectAABB(p1, p2, min, max) {
  let tmin = 0.0;
  let tmax = 1.0;
  const d = [p2[0]-p1[0], p2[1]-p1[1], p2[2]-p1[2]];
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

function createInitialLog() {
  const now = new Date();
  const fmt = (d) => d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entries = [];
  for (let i = 0; i < 6; i++) {
    const t = new Date(now.getTime() - (6 - i) * 3000);
    entries.push({ time: fmt(t), message: [
      'Simulation initialized',
      'UAV nodes spawned',
      'Link mesh established',
      'PAT pipeline active',
      'Coarse tracking engaged',
      'System nominal',
    ][i] });
  }
  return entries;
}

// ─── Environment disturbance profiles ───
const ENV_PROFILES = {
  CLEAR: {
    turbulenceBase: 0.1,
    noiseBase: 0.1,
    occlusionChance: 0.0,
    visibilityRange: 8000,
    fogDensity: 0,
    lightIntensity: 1.0,
  },
  CLOUDY_DYNAMIC: {
    turbulenceBase: 0.4,
    noiseBase: 0.3,
    occlusionChance: 0.15,
    visibilityRange: 5000,
    fogDensity: 0.3,
    lightIntensity: 0.7,
  },
  OVERCAST: {
    turbulenceBase: 0.6,
    noiseBase: 0.5,
    occlusionChance: 0.25,
    visibilityRange: 3000,
    fogDensity: 0.6,
    lightIntensity: 0.4,
  },
  NIGHT: {
    turbulenceBase: 0.3,
    noiseBase: 0.7,
    occlusionChance: 0.05,
    visibilityRange: 4000,
    fogDensity: 0.2,
    lightIntensity: 0.1,
  },
};

export const useSimStore = create((set, get) => ({
  // ─── Global Simulation Config ───
  numUAVs: 6,
  environment: 'CLOUDY_DYNAMIC',
  scenario: 'MULTI_UAV_MESH',
  trajectoryType: 'MIXED',
  simRunning: true,
  simPaused: false,
  simSpeed: 1.0,
  simTime: 0,
  simSeed: 26169,

  // ─── Environment profile (computed) ───
  envProfile: ENV_PROFILES['CLOUDY_DYNAMIC'],

  // ─── Camera / Sensor ───
  fov: 3,
  zoom: 1,
  turbulenceStrength: 0.4,
  noiseStrength: 0.3,

  // ─── Per-UAV State ───
  uavs: Array.from({ length: 6 }, (_, i) => createUAV(`UAV-${i + 1}`, i, 1000, 'MULTI_UAV_MESH', 'MIXED')),

  // ─── Link Matrix ───
  links: createInitialLinks(6, 'MULTI_UAV_MESH'),

  // ─── Cityscape ───
  buildings: createBuildings(),

  // ─── Disturbances ───
  disturbances: {
    atmosphericTurbulence: true,
    platformVibration: true,
    cameraMotion: true,
    imageNoise: true,
    motionBlur: true,
    temporaryOcclusion: false,
    weatherEffects: false,
  },

  // ─── Selected link for detail view ───
  selectedLink: 0,

  // ─── Tracking (legacy, used by camera feed) ───
  trackingState: TrackingState.TRACKING,
  pointingError: { x: 0, y: 0 },
  cameraCorrection: { x: 0, y: 0 },
  detectionBox: null,
  detectionConfidence: 0,
  targetPosition: [0, 0, -1000],

  // ─── Failure Injection ───
  sunGlintActive: false,
  occlusionActive: false,
  lowLightActive: false,
  signalDropoutActive: false,

  // ═══════════════════════════════════════════════
  // ═══ PART 4: Dual-Terminal Link Establishment ══
  // ═══════════════════════════════════════════════

  // ─── Part 4 Config ───
  p4Scenario: ScenarioLabel.BASELINE,
  detectorMode: DetectorMode.BLOB_CNN,
  searchPattern: 'raster',
  minSeparation: 800,
  searchSpeed: 0.15,
  linkDwellSeconds: 2.0,
  cnnConfidenceThreshold: 0.5,
  lockHoldSeconds: 1.0,

  // ─── Part 4 Disturbance Severity ───
  turbulenceSeverity: 0.5,
  occlusionSeverity: 0.5,
  sunGlintSeverity: 0.5,
  dropoutSeverity: 0.5,

  // ─── Part 4 Terminal State ───
  terminals: {
    A: createTerminalState('A'),
    B: createTerminalState('B'),
  },

  // ─── Part 4 Link State ───
  linkEstablished: false,
  linkEstablishedT: null,
  beamVisible: false,
  dualLockSince: null,
  deployT: 0,

  // ─── Part 4 Live Metrics ───
  p4Metrics: {
    acquisitionTime: null,
    trackingRMSE: 0,
    falsePositiveRate: 0,
    lockProbability: null,
    reactionLatency: 0,
    coarseTrackDuration: 0,
    coarseTrackStartT: null,
    disturbanceEventCount: 0,
    totalRawCandidates: 0,
    totalRejectedCandidates: 0,
    trackingSamples: [],
  },

  // ─── Part 4 Disturbance Events Log ───
  disturbanceEvents: [],

  // ─── Part 4 Run State ───
  p4RunActive: false,
  p4RunId: null,
  performanceLogOpen: false,

  // ─── Metrics ───
  metricsViewActive: false,

  // ─── PAT pipeline latencies (ms) ───
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

  // ─── System Performance ───
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

  // ─── Tracking history for chart ───
  trackingHistory: [],

  // ─── Event Log ───
  eventLog: createInitialLog(),

  // ─── Actions ───
  setNumUAVs: (n) => set(state => {
    const s = state.scenario;
    const t = state.trajectoryType;
    const a = state.globalAltitude;
    const uavs = Array.from({ length: n }, (_, i) =>
      i < state.uavs.length ? state.uavs[i] : createUAV(`UAV-${i + 1}`, i, a, s, t)
    );
    const links = createInitialLinks(n, s);
    return { numUAVs: n, uavs, links };
  }),

  setEnvironment: (env) => set(state => {
    const profile = ENV_PROFILES[env] || ENV_PROFILES.CLEAR;
    const logMsg = `Environment changed to ${env}`;
    const t = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const log = [...state.eventLog, { time: t, message: logMsg }];
    if (log.length > 50) log.shift();
    return {
      environment: env,
      envProfile: profile,
      turbulenceStrength: profile.turbulenceBase,
      noiseStrength: profile.noiseBase,
      eventLog: log,
    };
  }),

  setScenario: (s) => set(state => {
    const n = state.numUAVs;
    const a = state.globalAltitude;
    const traj = state.trajectoryType;
    const uavs = Array.from({ length: n }, (_, i) => createUAV(`UAV-${i + 1}`, i, a, s, traj));
    const links = createInitialLinks(n, s);
    const t = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const log = [...state.eventLog, { time: t, message: `Scenario changed to ${s.replace(/_/g, ' ')}` }];
    if (log.length > 50) log.shift();
    return { scenario: s, uavs, links, eventLog: log };
  }),

  setTrajectoryType: (t) => set(state => {
    const n = state.numUAVs;
    const a = state.globalAltitude;
    const s = state.scenario;
    const uavs = Array.from({ length: n }, (_, i) => createUAV(`UAV-${i + 1}`, i, a, s, t));
    const msg = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const log = [...state.eventLog, { time: msg, message: `Trajectory changed to ${t}` }];
    if (log.length > 50) log.shift();
    return { trajectoryType: t, uavs, eventLog: log };
  }),

  setSimRunning: (r) => set({ simRunning: r }),
  setSimPaused: (p) => set({ simPaused: p }),
  setSimSpeed: (s) => set({ simSpeed: s }),
  setSimTime: (t) => set({ simTime: t }),
  
  // Target overrides for all UAVs
  globalSpeed: 30,
  globalAltitude: 1000,
  setGlobalSpeed: (v) => set(state => {
    const uavs = state.uavs.map(u => ({ ...u, speed: v }));
    return { globalSpeed: v, uavs };
  }),

  // When altitude changes: move all UAVs to new altitude, regenerate their waypoints
  // at that altitude, and force all links into ACQUIRING state to simulate re-establishment
  setGlobalAltitude: (v) => set(state => {
    const s = state.scenario;
    const traj = state.trajectoryType;
    const uavs = state.uavs.map((u, i) => {
      // Regenerate waypoint queue at new altitude
      const newQueue = [
        generateWaypoint(v, s, traj, i),
        generateWaypoint(v, s, traj, i),
        generateWaypoint(v, s, traj, i),
      ];
      return {
        ...u,
        altitude: v,
        position: [u.position[0], v, u.position[2]],
        waypointQueue: newQueue,
        currentTarget: newQueue[0],
      };
    });

    // Force links into ACQUIRING so they re-establish at new altitude
    const links = state.links.map(l => ({
      ...l,
      state: 'ACQUIRING',
      confidence: 0.2,
    }));

    const t = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const log = [...state.eventLog, { time: t, message: `Altitude changed to ${v}m — links re-establishing` }];
    if (log.length > 50) log.shift();

    return { globalAltitude: v, uavs, links, eventLog: log };
  }),

  setDisturbance: (key, val) => set(state => {
    const newDist = { ...state.disturbances, [key]: val };
    const t = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const log = [...state.eventLog, { time: t, message: `${key}: ${val ? 'ON' : 'OFF'}` }];
    if (log.length > 50) log.shift();
    return { disturbances: newDist, eventLog: log };
  }),

  setSelectedLink: (idx) => set({ selectedLink: idx }),

  // Legacy actions
  setTargetPosition: (pos) => set({ targetPosition: pos }),
  setDetection: (uavIndex, box, confidence) => set(state => {
    const uavs = [...state.uavs];
    if (uavs[uavIndex]) uavs[uavIndex] = { ...uavs[uavIndex], confidence, detectionBox: box };
    return { detectionBox: box, detectionConfidence: confidence, uavs };
  }),
  setTrackingState: (uavIndex, stateVal) => set(state => {
    const uavs = [...state.uavs];
    if (uavs[uavIndex]) uavs[uavIndex] = { ...uavs[uavIndex], trackingState: stateVal };
    return { trackingState: stateVal, uavs };
  }),
  setMotionOverrideActive: (idx, active) => set(state => {
    const uavs = [...state.uavs];
    if(uavs[idx]) uavs[idx] = { ...uavs[idx], overrideActive: active };
    return { uavs };
  }),
  setOverrideTarget: (idx, pos) => set(state => {
    const uavs = [...state.uavs];
    if(uavs[idx]) uavs[idx] = { ...uavs[idx], overrideTarget: pos };
    return { uavs };
  }),
  setReacquireState: (idx, startTime, lastKnownPos) => set(state => {
    const uavs = [...state.uavs];
    if(uavs[idx]) uavs[idx] = { ...uavs[idx], reacquireStartTime: startTime, lastKnownPosition: lastKnownPos, consecutiveLockFrames: 0 };
    return { uavs };
  }),
  incrementConsecutiveLockFrames: (idx) => set(state => {
    const uavs = [...state.uavs];
    if(uavs[idx]) uavs[idx] = { ...uavs[idx], consecutiveLockFrames: (uavs[idx].consecutiveLockFrames || 0) + 1 };
    return { uavs };
  }),
  resetConsecutiveLockFrames: (idx) => set(state => {
    const uavs = [...state.uavs];
    if(uavs[idx]) uavs[idx] = { ...uavs[idx], consecutiveLockFrames: 0 };
    return { uavs };
  }),
  popWaypoint: (idx) => set(state => {
    const uavs = [...state.uavs];
    if(uavs[idx]) {
      const q = [...uavs[idx].waypointQueue];
      q.shift();
      q.push(generateWaypoint(state.globalAltitude, state.scenario, state.trajectoryType, idx));
      uavs[idx] = { ...uavs[idx], waypointQueue: q, currentTarget: q[0] };
    }
    return { uavs };
  }),
  setPointingError: (uavIndex, err) => set(state => {
    const uavs = [...state.uavs];
    const errMag = Math.sqrt(err.x*err.x + err.y*err.y) * 1000;
    if (uavs[uavIndex]) uavs[uavIndex] = { ...uavs[uavIndex], pointingError: errMag };
    
    const history = [...state.trackingHistory];
    history.push({
      time: state.simTime.toFixed(1),
      actual: errMag,
      predicted: errMag * 0.8
    });
    if (history.length > 50) history.shift();

    return { pointingError: err, uavs, trackingHistory: history };
  }),
  setCameraCorrection: (corr) => set({ cameraCorrection: corr }),
  setTurbulenceStrength: (val) => set({ turbulenceStrength: val }),
  setNoiseStrength: (val) => set({ noiseStrength: val }),
  setMetricsViewActive: (a) => set({ metricsViewActive: a }),

  triggerFailure: (type, duration = 3000) => {
    set({ [type]: true });
    if (duration > 0) setTimeout(() => set({ [type]: false }), duration);
  },

  // UAV position updates (called from 3D world tick)
  updateUAVPosition: (idx, pos, alt) => set(state => {
    const uavs = [...state.uavs];
    uavs[idx] = { ...uavs[idx], position: pos, altitude: Math.floor(alt) };
    return { uavs };
  }),

  // Physical Line-of-Sight check against ALL buildings
  updateLinksLOS: () => set(state => {
    const newLinks = [...state.links];
    let changed = false;
    const logEntries = [];

    // Altitude-based link degradation: lower altitude → higher chance of building occlusion
    // This is handled naturally by the ray-AABB check since UAVs at lower altitude
    // are more likely to be blocked by buildings

    for (let i = 0; i < newLinks.length; i++) {
      const link = newLinks[i];
      if (link.from >= state.numUAVs || link.to >= state.numUAVs) continue;

      const p1 = state.uavs[link.from].position;
      const p2 = state.uavs[link.to].position;

      // Calculate distance between UAVs for link quality
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const dz = p2[2] - p1[2];
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) / 1000; // km

      // Test ray against every building
      let occluded = false;
      for (const b of state.buildings) {
        const bmin = [b.x - b.width / 2, 0, b.z - b.depth / 2];
        const bmax = [b.x + b.width / 2, b.height, b.z + b.depth / 2];
        if (rayIntersectAABB(p1, p2, bmin, bmax)) {
          occluded = true;
          break;
        }
      }

      // Environment-based random occlusion (weather effects)
      if (!occluded && state.disturbances.weatherEffects) {
        const envOccChance = state.envProfile.occlusionChance;
        if (Math.random() < envOccChance * 0.02) {
          occluded = true;
        }
      }

      // Temporary occlusion disturbance toggle
      if (!occluded && state.disturbances.temporaryOcclusion) {
        if (Math.random() < 0.005) {
          occluded = true;
        }
      }

      // State transitions
      if (occluded && link.losClear) {
        newLinks[i] = { ...link, losClear: false, state: 'LOST', confidence: 0, distance: dist };
        logEntries.push(`Link UAV-${link.from+1}↔UAV-${link.to+1} LOST — obstruction`);
        changed = true;
      } else if (!occluded && !link.losClear) {
        newLinks[i] = { ...link, losClear: true, state: 'ACQUIRING', confidence: 0.3, distance: dist };
        logEntries.push(`Link UAV-${link.from+1}↔UAV-${link.to+1} re-acquiring`);
        changed = true;
      } else if (!occluded && link.state === 'ACQUIRING') {
        // Environment affects re-acquisition speed
        const acqSpeed = state.envProfile.lightIntensity * 0.02;
        const newConf = link.confidence + acqSpeed;
        if (newConf >= 0.9) {
          newLinks[i] = { ...link, state: 'LOCKED', confidence: 0.95, distance: dist };
          logEntries.push(`Link UAV-${link.from+1}↔UAV-${link.to+1} LOCKED`);
        } else {
          newLinks[i] = { ...link, confidence: newConf, distance: dist };
        }
        changed = true;
      } else if (!occluded && link.state === 'LOCKED') {
        // Update distance and link metrics
        const envNoise = state.disturbances.atmosphericTurbulence ? state.envProfile.turbulenceBase * Math.random() : 0;
        const imgNoise = state.disturbances.imageNoise ? state.envProfile.noiseBase * Math.random() * 0.5 : 0;
        const vibration = state.disturbances.platformVibration ? Math.random() * 0.3 : 0;
        
        const angError = (0.2 + envNoise + imgNoise + vibration) * (1 + dist * 0.1);
        const margin = Math.max(0, 8 - dist * 1.5 - envNoise * 3);
        const rxPow = -25 - dist * 3 - envNoise * 5;

        newLinks[i] = {
          ...link,
          distance: dist,
          angularError: angError,
          predictedError: angError * 0.7,
          linkMargin: margin,
          receivedPower: rxPow,
          confidence: Math.max(0.85, 1 - angError * 0.05),
        };
        changed = true;
      }
    }

    if (logEntries.length > 0) {
      const t = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const log = [...state.eventLog];
      logEntries.forEach(msg => log.push({ time: t, message: msg }));
      if (log.length > 50) log.splice(0, log.length - 50);
      return changed ? { links: newLinks, eventLog: log } : {};
    }

    return changed ? { links: newLinks } : {};
  }),

  // Update link state
  updateLink: (idx, data) => set(state => {
    const links = [...state.links];
    links[idx] = { ...links[idx], ...data };
    return { links };
  }),

  addEvent: (message) => set(state => {
    const t = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const log = [...state.eventLog, { time: t, message }];
    if (log.length > 50) log.shift();
    return { eventLog: log };
  }),

  addTrackingPoint: (point) => set(state => {
    const hist = [...state.trackingHistory, point];
    if (hist.length > 250) hist.shift();
    return { trackingHistory: hist };
  }),

  resetSim: () => set(state => ({
    simTime: 0,
    simRunning: false,
    simPaused: false,
    uavs: Array.from({ length: state.numUAVs }, (_, i) => createUAV(`UAV-${i + 1}`, i, state.globalAltitude, state.scenario, state.trajectoryType)),
    links: createInitialLinks(state.numUAVs, state.scenario),
    trackingHistory: [],
    eventLog: createInitialLog(),
  })),

  // ═══════════════════════════════════════
  // ═══ PART 4 ACTIONS ═══════════════════
  // ═══════════════════════════════════════

  setP4Scenario: (s) => set({ p4Scenario: s }),
  setDetectorMode: (m) => set({ detectorMode: m }),
  setSearchPattern: (p) => set({ searchPattern: p }),
  setLinkDwellSeconds: (v) => set({ linkDwellSeconds: v }),
  setTurbulenceSeverity: (v) => set({ turbulenceSeverity: v }),
  setOcclusionSeverity: (v) => set({ occlusionSeverity: v }),
  setSunGlintSeverity: (v) => set({ sunGlintSeverity: v }),
  setDropoutSeverity: (v) => set({ dropoutSeverity: v }),
  setPerformanceLogOpen: (v) => set({ performanceLogOpen: v }),

  updateTerminal: (id, data) => set(state => ({
    terminals: {
      ...state.terminals,
      [id]: { ...state.terminals[id], ...data },
    },
  })),

  updateP4Metrics: (data) => set(state => ({
    p4Metrics: { ...state.p4Metrics, ...data },
  })),

  addDisturbanceEvent: (evt) => set(state => ({
    disturbanceEvents: [...state.disturbanceEvents, evt],
    p4Metrics: {
      ...state.p4Metrics,
      disturbanceEventCount: state.p4Metrics.disturbanceEventCount + 1,
    },
  })),

  setLinkEstablished: (t) => set(state => {
    const acqTime = t - state.deployT;
    return {
      linkEstablished: true,
      linkEstablishedT: t,
      beamVisible: true,
      p4Metrics: {
        ...state.p4Metrics,
        acquisitionTime: acqTime,
        coarseTrackStartT: t,
      },
    };
  }),

  setBeamVisible: (v) => set({ beamVisible: v }),
  setDualLockSince: (t) => set({ dualLockSince: t }),

  /** Part 4 Reset — spawns terminals at seeded positions, clears run state */
  resetPart4: (scenario, detectorMode, seed) => {
    const rng = resetSimRNG(seed || 26169);
    const minSep = get().minSeparation;

    // Deterministic terminal positions with enforced min separation
    let ax, az, bx, bz;
    let attempts = 0;
    do {
      ax = rng.range(-1200, 1200);
      az = rng.range(-1200, 1200);
      bx = rng.range(-1200, 1200);
      bz = rng.range(-1200, 1200);
      attempts++;
    } while (
      Math.sqrt((bx - ax) ** 2 + (bz - az) ** 2) < minSep && attempts < 100
    );

    const alt = get().globalAltitude || 1000;

    // Update UAV positions — UAV-1 = Terminal A, UAV-2 = Terminal B
    const uavs = get().uavs.map((u, i) => {
      if (i === 0) return { ...u, position: [ax, alt, az], trackingState: 'SEARCHING' };
      if (i === 1) return { ...u, position: [bx, alt, bz], trackingState: 'SEARCHING' };
      return u;
    });

    const t = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    set({
      simTime: 0,
      simRunning: true,
      simPaused: false,
      simSeed: seed || 26169,
      p4Scenario: scenario || ScenarioLabel.BASELINE,
      detectorMode: detectorMode || DetectorMode.BLOB_CNN,
      uavs,
      terminals: {
        A: createTerminalState('A'),
        B: createTerminalState('B'),
      },
      linkEstablished: false,
      linkEstablishedT: null,
      beamVisible: false,
      dualLockSince: null,
      deployT: 0,
      p4Metrics: {
        acquisitionTime: null,
        trackingRMSE: 0,
        falsePositiveRate: 0,
        lockProbability: null,
        reactionLatency: 0,
        coarseTrackDuration: 0,
        coarseTrackStartT: null,
        disturbanceEventCount: 0,
        totalRawCandidates: 0,
        totalRejectedCandidates: 0,
        trackingSamples: [],
      },
      disturbanceEvents: [],
      p4RunActive: true,
      p4RunId: `run-${Date.now()}-${Math.floor(rng.next() * 10000)}`,
      trackingHistory: [],
      eventLog: [
        { time: t, message: `Part 4 reset — scenario: ${scenario || 'baseline'}, mode: ${detectorMode || 'blob+CNN'}, seed: ${seed || 26169}` },
        { time: t, message: 'Terminals A & B deployed' },
      ],
    });
  },

  /** Finish the current Part 4 run — returns the performance row */
  finishP4Run: () => {
    const state = get();
    if (!state.p4RunActive) return null;

    const metrics = state.p4Metrics;
    const samples = metrics.trackingSamples;
    const rmse = samples.length > 0
      ? Math.sqrt(samples.reduce((s, v) => s + v * v, 0) / samples.length)
      : 0;

    const fpr = metrics.totalRawCandidates > 0
      ? metrics.totalRejectedCandidates / metrics.totalRawCandidates
      : 0;

    const coarseDur = metrics.coarseTrackStartT !== null
      ? state.simTime - metrics.coarseTrackStartT
      : 0;

    const termA = state.terminals.A;
    const termB = state.terminals.B;
    const totalReacq = termA.reacquireCount + termB.reacquireCount;
    const allReacqTimes = [...termA.reacquireTimes, ...termB.reacquireTimes];
    const meanReacqTime = allReacqTimes.length > 0
      ? allReacqTimes.reduce((a, b) => a + b, 0) / allReacqTimes.length
      : 0;

    const row = {
      run_id: state.p4RunId,
      timestamp: new Date().toISOString(),
      scenario: state.p4Scenario,
      detector_mode: state.detectorMode,
      acquisition_time: metrics.acquisitionTime !== null ? +metrics.acquisitionTime.toFixed(3) : null,
      tracking_RMSE: +rmse.toFixed(4),
      false_positive_rate: +fpr.toFixed(4),
      lock_probability: metrics.lockProbability,
      reacquire_count: totalReacq,
      mean_reacquire_time: +meanReacqTime.toFixed(3),
      disturbance_events: metrics.disturbanceEventCount,
    };

    set({
      p4RunActive: false,
      p4Metrics: { ...metrics, coarseTrackDuration: coarseDur },
    });

    const t = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    get().addEvent(`Run finished: ${state.p4RunId}`);

    return row;
  },
}));
