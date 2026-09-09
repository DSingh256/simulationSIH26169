/** Optical / visual environment presets for the FSOC terminal sim. */

export const TX_POWER_DBM = 20;
export const RX_SENSITIVITY_DBM = -42;
export const WEATHER_RAIN_DB_KM = 6.5;
export const WEATHER_FLAT_PENALTY_DB = 3.2;

export const ENV_PRESETS = {
  CLEAR: {
    label: 'Clear',
    attenuationDbKm: 0.2,
    ambient: 1.15,
    sun: 2.6,
    sunPosition: [800, 2400, 400],
    turbidity: 1.8,
    rayleigh: 0.8,
    fogNear: 3500,
    fogFar: 14000,
    fogColor: '#87a0b8',
    bg: '#6a8498',
    cityGlow: 1.2,
  },
  CLOUDY_DYNAMIC: {
    label: 'Cloudy',
    attenuationDbKm: 1.6,
    ambient: 0.55,
    sun: 1.15,
    sunPosition: [400, 1800, 800],
    turbidity: 12,
    rayleigh: 2.4,
    fogNear: 1400,
    fogFar: 7000,
    fogColor: '#2a3038',
    bg: '#1a1e24',
    cityGlow: 2.2,
  },
  OVERCAST: {
    label: 'Overcast',
    attenuationDbKm: 4.2,
    ambient: 0.28,
    sun: 0.35,
    sunPosition: [200, 1600, 200],
    turbidity: 18,
    rayleigh: 0.4,
    fogNear: 800,
    fogFar: 4500,
    fogColor: '#15181c',
    bg: '#101216',
    cityGlow: 2.8,
  },
  NIGHT: {
    label: 'Night',
    attenuationDbKm: 0.35,
    ambient: 0.06,
    sun: 0.04,
    sunPosition: [-600, 400, -800],
    turbidity: 2,
    rayleigh: 0.2,
    fogNear: 900,
    fogFar: 5200,
    fogColor: '#05060a',
    bg: '#030308',
    cityGlow: 4.5,
  },
};

export function opticalAttenuation(environment, weatherOn) {
  const base = ENV_PRESETS[environment]?.attenuationDbKm ?? 1.6;
  return base + (weatherOn ? WEATHER_RAIN_DB_KM : 0);
}

export function uniquePairKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function makeLink(from, to, discoverDelay = 1) {
  return {
    from,
    to,
    state: 'SEARCHING',
    distance: 0,
    angularError: 2.5,
    predictedError: 2.0,
    confidence: 0,
    receivedPower: -45,
    linkMargin: 0,
    losClear: true,
    discoverDelay,
  };
}

/** Build optical mesh according to the selected scenario. Links start dark — they acquire over time. */
export function createLinksForScenario(scenario, numUAVs) {
  const n = Math.max(2, numUAVs);
  const seen = new Set();
  const pairs = [];

  const add = (a, b) => {
    if (a === b || a < 0 || b < 0 || a >= n || b >= n) return;
    const key = uniquePairKey(a, b);
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push([a, b]);
  };

  switch (scenario) {
    case 'POINT_TO_POINT':
      add(0, 1);
      break;
    case 'RELAY_CHAIN':
      for (let i = 0; i < n - 1; i++) add(i, i + 1);
      break;
    case 'STAR_TOPOLOGY':
      for (let i = 1; i < n; i++) add(0, i);
      break;
    case 'MULTI_UAV_MESH':
    default:
      for (let i = 0; i < n; i++) add(i, (i + 1) % n);
      if (n >= 4) {
        for (let i = 0; i < n; i++) add(i, (i + 2) % n);
      }
      break;
  }

  return pairs.map(([from, to], i) => makeLink(from, to, 0.85 + i * 1.15));
}

export function resetLinksToSearch(links) {
  return links.map((l, i) => ({
    ...l,
    state: 'SEARCHING',
    confidence: 0,
    losClear: true,
    receivedPower: -45,
    linkMargin: 0,
    angularError: 2.5,
    discoverDelay: 0.85 + i * 1.15,
  }));
}

export function layoutPositions(numUAVs, scenario, altitude) {
  const n = Math.max(2, numUAVs);
  const positions = [];
  if (scenario === 'STAR_TOPOLOGY') {
    positions.push([0, altitude, 0]);
    for (let i = 1; i < n; i++) {
      const a = ((i - 1) / (n - 1)) * Math.PI * 2;
      const r = 1100;
      positions.push([Math.cos(a) * r, altitude, Math.sin(a) * r]);
    }
  } else if (scenario === 'RELAY_CHAIN' || scenario === 'POINT_TO_POINT') {
    const span = 2200;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      positions.push([(t - 0.5) * span, altitude, (i % 2 === 0 ? -80 : 80)]);
    }
  } else {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 800 + (i % 3) * 180;
      positions.push([Math.cos(a) * r, altitude, Math.sin(a) * r]);
    }
  }
  return positions;
}

export function linkBudget({ distM, attenuationDbKm, weatherOn, pointingUrad, turbulence, vibration }) {
  const distKm = Math.max(distM / 1000, 0.01);
  const geometric = 20 * Math.log10(distKm * 100); // simplified range term
  const atmos = attenuationDbKm * distKm;
  const pointingLoss = Math.min(12, (pointingUrad / 8) * 1.5);
  const scintillation = turbulence ? 0.8 + Math.random() * 1.6 : 0.15;
  const vibLoss = vibration ? 0.4 + Math.random() * 0.9 : 0;
  const weatherFlat = weatherOn ? WEATHER_FLAT_PENALTY_DB : 0;
  const receivedPower = TX_POWER_DBM - geometric - atmos - pointingLoss - scintillation - vibLoss - weatherFlat;
  const linkMargin = receivedPower - RX_SENSITIVITY_DBM;
  return { distKm, receivedPower, linkMargin, pointingLoss };
}

/** False beacons that sit near the real UAV so the camera must reject them. */
export function decoyWorldPositions(targetPos) {
  const [x, y, z] = targetPos;
  return [
    { id: 'glint', kind: 'SUN GLINT', color: '#ffe8a0', position: [x + 95, y - 38, z + 55] },
    { id: 'lamp', kind: 'STREET LAMP', color: '#ff9944', position: [x - 85, y - 150, z + 90] },
  ];
}
