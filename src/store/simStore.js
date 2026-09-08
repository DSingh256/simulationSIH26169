import { create } from 'zustand';

export const TrackingState = {
  SEARCHING: 'SEARCHING',
  TRACKING: 'TRACKING',
  REACQUIRING: 'REACQUIRING',
  LOCKED: 'LOCKED',
  ACQUIRING: 'ACQUIRING',
};

function generateWaypoint() {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * 1500;
  return [Math.cos(angle) * radius, 900 + Math.random() * 200, Math.sin(angle) * radius];
}

// Generate initial UAV data
function createUAV(id, idx) {
  const angle = (idx / 6) * Math.PI * 2;
  const radius = 800 + Math.random() * 400;
  const pos = [Math.cos(angle) * radius, 900 + Math.random() * 200, Math.sin(angle) * radius];
  const queue = [generateWaypoint(), generateWaypoint(), generateWaypoint()];
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

function createInitialLinks(numUAVs) {
  const links = [];
  // Create a mesh network (each UAV links to the next, plus some cross-links)
  for (let i = 0; i < numUAVs; i++) {
    const j = (i + 1) % numUAVs;
    links.push({
      from: i,
      to: j,
      state: 'LOCKED',
      distance: 1.5 + Math.random() * 2,
      angularError: Math.random() * 1.5,
      predictedError: Math.random() * 0.5,
      confidence: 0.85 + Math.random() * 0.13,
      receivedPower: -30 + Math.random() * 5,
      linkMargin: 4 + Math.random() * 4,
      losClear: true
    });
  }
  return links;
}

function createBuildings() {
  const buildings = [];
  // Create a dense grid of 3D buildings
  for (let i = 0; i < 40; i++) {
    buildings.push({
      x: (Math.random() - 0.5) * 3000,
      z: (Math.random() - 0.5) * 3000,
      width: 100 + Math.random() * 200,
      depth: 100 + Math.random() * 200,
      height: 300 + Math.random() * 800 // Tall enough to occlude drones
    });
  }
  return buildings;
}

// Ray-AABB intersection test: does the line segment from p1→p2 pass through the box [min, max]?
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
  for (let i = 0; i < 12; i++) {
    const t = new Date(now.getTime() - (12 - i) * 3000);
    entries.push({ time: fmt(t), message: [
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
    ][i] });
  }
  return entries;
}

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
  simSeed: 42,

  // ─── Camera / Sensor (kept for individual feeds) ───
  fov: 3,
  zoom: 1,
  turbulenceStrength: 0.5,
  noiseStrength: 0.3,

  // ─── Per-UAV State ───
  uavs: Array.from({ length: 6 }, (_, i) => createUAV(`UAV-${i + 1}`, i)),

  // ─── Link Matrix ───
  links: createInitialLinks(6),

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
  selectedLink: 0, // index into links array

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
  setNumUAVs: (n) => set({ numUAVs: n }),
  setEnvironment: (env) => set({ environment: env }),
  setScenario: (s) => set({ scenario: s }),
  setTrajectoryType: (t) => set({ trajectoryType: t }),
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
  setGlobalAltitude: (v) => set(state => {
    const uavs = state.uavs.map(u => ({ ...u, altitude: v, position: [u.position[0], v, u.position[2]] }));
    return { globalAltitude: v, uavs };
  }),

  setDisturbance: (key, val) => set(state => ({
    disturbances: { ...state.disturbances, [key]: val }
  })),

  setSelectedLink: (idx) => set({ selectedLink: idx }),

  // Legacy actions (for camera feed tracking) - Sync to UAV-0 for the dashboard
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
      q.push(generateWaypoint());
      uavs[idx] = { ...uavs[idx], waypointQueue: q, currentTarget: q[0] };
    }
    return { uavs };
  }),
  setPointingError: (uavIndex, err) => set(state => {
    const uavs = [...state.uavs];
    const errMag = Math.sqrt(err.x*err.x + err.y*err.y) * 1000;
    if (uavs[uavIndex]) uavs[uavIndex] = { ...uavs[uavIndex], pointingError: errMag };
    
    // Also push to tracking history
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

  // Physical Line-of-Sight check: ray-cast each link against ALL buildings
  updateLinksLOS: () => set(state => {
    const newLinks = [...state.links];
    let changed = false;
    const logEntries = [];

    for (let i = 0; i < newLinks.length; i++) {
      const link = newLinks[i];
      if (link.from >= state.numUAVs || link.to >= state.numUAVs) continue;

      const p1 = state.uavs[link.from].position;
      const p2 = state.uavs[link.to].position;

      // Test ray against every building bounding box
      let occluded = false;
      for (const b of state.buildings) {
        const bmin = [b.x - b.width / 2, 0, b.z - b.depth / 2];
        const bmax = [b.x + b.width / 2, b.height, b.z + b.depth / 2];
        if (rayIntersectAABB(p1, p2, bmin, bmax)) {
          occluded = true;
          break;
        }
      }

      // State transitions based on physical occlusion
      if (occluded && link.losClear) {
        // JUST GOT BLOCKED — laser path is obstructed
        newLinks[i] = { ...link, losClear: false, state: 'LOST', confidence: 0 };
        logEntries.push(`Link UAV-${link.from+1}↔UAV-${link.to+1} LOST — building obstruction`);
        changed = true;
      } else if (!occluded && !link.losClear) {
        // JUST CLEARED — begin re-acquisition
        newLinks[i] = { ...link, losClear: true, state: 'ACQUIRING', confidence: 0.3 };
        logEntries.push(`Link UAV-${link.from+1}↔UAV-${link.to+1} re-acquiring — LOS clear`);
        changed = true;
      } else if (!occluded && link.state === 'ACQUIRING') {
        // Gradually lock on (simulate PAT re-acquisition time)
        const newConf = link.confidence + 0.02;
        if (newConf >= 0.9) {
          newLinks[i] = { ...link, state: 'LOCKED', confidence: 0.95 };
          logEntries.push(`Link UAV-${link.from+1}↔UAV-${link.to+1} LOCKED`);
        } else {
          newLinks[i] = { ...link, confidence: newConf };
        }
        changed = true;
      }
    }

    // Push events to log
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

  // Add event
  addEvent: (message) => set(state => {
    const t = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const log = [...state.eventLog, { time: t, message }];
    if (log.length > 50) log.shift();
    return { eventLog: log };
  }),

  // Add tracking history point
  addTrackingPoint: (point) => set(state => {
    const hist = [...state.trackingHistory, point];
    if (hist.length > 250) hist.shift();
    return { trackingHistory: hist };
  }),

  // Reset simulation
  resetSim: () => set({
    simTime: 0,
    simRunning: false,
    simPaused: false,
    uavs: Array.from({ length: 6 }, (_, i) => createUAV(`UAV-${i + 1}`, i)),
    links: createInitialLinks(6),
    trackingHistory: [],
    eventLog: createInitialLog(),
  }),
}));
