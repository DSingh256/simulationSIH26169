/**
 * Search Pattern Generators for gimbal sweep.
 * Produces yaw/pitch setpoints for PID-driven gimbal search.
 * Tracks coverage numerically.
 */

const TWO_PI = Math.PI * 2;

/**
 * Raster scan pattern — sweeps rows left-right across the FOV.
 * @param {number} elapsed - seconds since search started
 * @param {object} config - { fovWidth, fovHeight, speed, rowCount }
 * @returns {{ yaw: number, pitch: number, coverage: number }}
 */
export function rasterSetpoint(elapsed, config = {}) {
  const {
    fovWidth = 1.0,     // radians total yaw range
    fovHeight = 0.8,    // radians total pitch range
    speed = 0.15,       // radians/second sweep speed
    rowCount = 10,
  } = config;

  const halfW = fovWidth / 2;
  const halfH = fovHeight / 2;
  const rowHeight = fovHeight / rowCount;

  // Time to sweep one row
  const rowTime = fovWidth / speed;
  const totalTime = rowTime * rowCount;

  // Current position in the cycle
  const cycleT = elapsed % totalTime;
  const rowIndex = Math.floor(cycleT / rowTime);
  const rowProgress = (cycleT % rowTime) / rowTime;

  // Alternate sweep direction each row
  const leftToRight = rowIndex % 2 === 0;
  const yawNorm = leftToRight ? rowProgress : 1 - rowProgress;

  const yaw = -halfW + yawNorm * fovWidth;
  const pitch = -halfH + (rowIndex + 0.5) * rowHeight;

  // Coverage: how much of the total pattern has been completed
  const coverage = Math.min(1.0, cycleT / totalTime);

  return { yaw, pitch, coverage };
}

/**
 * Spiral scan pattern — expanding spiral from center outward.
 * @param {number} elapsed - seconds since search started
 * @param {object} config - { maxRadius, speed, expansionRate }
 * @returns {{ yaw: number, pitch: number, coverage: number }}
 */
export function spiralSetpoint(elapsed, config = {}) {
  const {
    maxRadius = 0.5,    // max radians from center
    speed = 2.0,        // angular speed (rad/s around spiral)
    expansionRate = 0.02, // radius growth per second
  } = config;

  const radius = Math.min(maxRadius, elapsed * expansionRate);
  const angle = elapsed * speed;

  const yaw = Math.cos(angle) * radius;
  const pitch = Math.sin(angle) * radius;

  // Coverage approximation: fraction of max area swept
  const coverage = Math.min(1.0, (radius / maxRadius) ** 2);

  return { yaw, pitch, coverage };
}

/**
 * Get the setpoint for the current search pattern.
 * @param {'raster'|'spiral'} pattern
 * @param {number} elapsed - seconds since search started
 * @param {object} config - pattern-specific config
 */
export function getSearchSetpoint(pattern, elapsed, config = {}) {
  if (pattern === 'spiral') {
    return spiralSetpoint(elapsed, config);
  }
  return rasterSetpoint(elapsed, config);
}
