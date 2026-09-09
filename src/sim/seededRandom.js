/**
 * Deterministic Seeded PRNG — Mulberry32
 * Provides reproducible random values for simulation reset/replay.
 */

export class SeededRandom {
  constructor(seed = 42) {
    this._seed = seed;
    this._state = seed;
  }

  /** Reset to the original seed */
  reset(newSeed) {
    if (newSeed !== undefined) this._seed = newSeed;
    this._state = this._seed;
  }

  /** Returns a float in [0, 1) */
  next() {
    let t = (this._state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a float in [min, max) */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /** Returns an integer in [min, max] inclusive */
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  /** Returns a normally-distributed value (Box-Muller) */
  gaussian(mean = 0, stddev = 1) {
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1 || 1e-10)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stddev;
  }

  get seed() {
    return this._seed;
  }
}

// Singleton for the simulation
let _instance = new SeededRandom(26169);

export function getSimRNG() {
  return _instance;
}

export function resetSimRNG(seed = 26169) {
  _instance.reset(seed);
  return _instance;
}
