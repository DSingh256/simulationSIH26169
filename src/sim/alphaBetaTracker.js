/**
 * Alpha-Beta (g-h) Target Tracker with Temporal Consistency Gate
 * 
 * Inspired by competitor's TargetTracker — a minimal state estimator that:
 * 1. Tracks position + velocity using alpha-beta filter (simpler than Kalman)
 * 2. Rejects detections that jump too far from predicted position (gate)
 * 3. Requires N spatially consistent consecutive detections before confirming
 * 4. Bridges brief detection gaps by coasting on predicted trajectory
 * 
 * This is ADDITIVE — the existing Kalman worker remains untouched.
 */

export const TrackerState = {
  UNINITIALIZED: 'UNINITIALIZED',
  ACQUIRING: 'ACQUIRING',
  CONFIRMED: 'CONFIRMED',
  COASTING: 'COASTING',
  LOST: 'LOST',
};

export class AlphaBetaTracker {
  constructor(config = {}) {
    // Filter gains (alpha for position, beta for velocity)
    this.alpha = config.alpha ?? 0.85;
    this.beta = config.beta ?? 0.005;

    // Gate radius — max pixels a detection can deviate from prediction
    this.gateRadius = config.gateRadius ?? 60.0;

    // Acquisition: require this many consistent detections to confirm
    this.acquireThreshold = config.acquireThreshold ?? 5;

    // Coasting: max frames to coast before declaring LOST
    this.coastMaxFrames = config.coastMaxFrames ?? 30;

    // Internal state
    this.state = TrackerState.UNINITIALIZED;
    this.x = 0;          // estimated position x
    this.y = 0;          // estimated position y
    this.vx = 0;         // estimated velocity x
    this.vy = 0;         // estimated velocity y
    this.residualX = 0;  // last measurement residual
    this.residualY = 0;
    this.trackAge = 0;   // frames since acquisition started
    this.coastFrames = 0; // frames coasting without detection
    this.acquireCount = 0; // consecutive consistent detections during acquisition
    this.lastAcquireX = 0;
    this.lastAcquireY = 0;
    this.gatedOut = false; // was last detection rejected by gate?
    this.dt = 1.0; // normalized time step
  }

  /**
   * Predict step — advance state by one frame
   */
  predict() {
    this.x += this.vx * this.dt;
    this.y += this.vy * this.dt;
    this.trackAge++;
  }

  /**
   * Update step — incorporate a new measurement (or lack thereof)
   * @param {number|null} measX - measured x position, or null if no detection
   * @param {number|null} measY - measured y position, or null if no detection
   * @returns {object} - { accepted, gated, state, position, velocity, residual }
   */
  update(measX, measY) {
    const hasDetection = measX !== null && measY !== null && !isNaN(measX) && !isNaN(measY);

    // ─── UNINITIALIZED ───
    if (this.state === TrackerState.UNINITIALIZED) {
      if (hasDetection) {
        this.x = measX;
        this.y = measY;
        this.vx = 0;
        this.vy = 0;
        this.lastAcquireX = measX;
        this.lastAcquireY = measY;
        this.acquireCount = 1;
        this.state = TrackerState.ACQUIRING;
        this.trackAge = 0;
        this.coastFrames = 0;
        this.gatedOut = false;
        return this._result(true);
      }
      return this._result(false);
    }

    // Predict first
    this.predict();

    // ─── ACQUIRING ───
    if (this.state === TrackerState.ACQUIRING) {
      if (hasDetection) {
        // Spatial consistency check against last acquire position
        const dx = measX - this.lastAcquireX;
        const dy = measY - this.lastAcquireY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.gateRadius) {
          this.acquireCount++;
          this.lastAcquireX = measX;
          this.lastAcquireY = measY;
          // Update position estimate
          this.x = measX;
          this.y = measY;
          this.gatedOut = false;

          if (this.acquireCount >= this.acquireThreshold) {
            this.state = TrackerState.CONFIRMED;
            this.coastFrames = 0;
          }
          return this._result(true);
        } else {
          // Spatially incoherent — restart acquisition from this new point
          this.acquireCount = 1;
          this.lastAcquireX = measX;
          this.lastAcquireY = measY;
          this.x = measX;
          this.y = measY;
          this.vx = 0;
          this.vy = 0;
          this.gatedOut = true;
          return this._result(false);
        }
      } else {
        // No detection during acquisition — reset
        this.acquireCount = 0;
        this.state = TrackerState.UNINITIALIZED;
        this.gatedOut = false;
        return this._result(false);
      }
    }

    // ─── CONFIRMED ───
    if (this.state === TrackerState.CONFIRMED) {
      if (hasDetection) {
        // Gate check: is this detection within gate radius of prediction?
        const rx = measX - this.x;
        const ry = measY - this.y;
        const dist = Math.sqrt(rx * rx + ry * ry);

        if (dist < this.gateRadius) {
          // Accept — alpha-beta update
          this.residualX = rx;
          this.residualY = ry;
          this.x += this.alpha * rx;
          this.y += this.alpha * ry;
          this.vx += (this.beta / this.dt) * rx;
          this.vy += (this.beta / this.dt) * ry;
          this.coastFrames = 0;
          this.gatedOut = false;
          return this._result(true);
        } else {
          // Gated out — reject this detection, keep coasting
          this.gatedOut = true;
          this.coastFrames++;
          if (this.coastFrames > this.coastMaxFrames) {
            this.state = TrackerState.LOST;
          } else {
            this.state = TrackerState.COASTING;
          }
          return this._result(false);
        }
      } else {
        // No detection — start coasting
        this.coastFrames++;
        this.gatedOut = false;
        if (this.coastFrames > this.coastMaxFrames) {
          this.state = TrackerState.LOST;
        } else {
          this.state = TrackerState.COASTING;
        }
        return this._result(false);
      }
    }

    // ─── COASTING ───
    if (this.state === TrackerState.COASTING) {
      if (hasDetection) {
        // Gate check
        const rx = measX - this.x;
        const ry = measY - this.y;
        const dist = Math.sqrt(rx * rx + ry * ry);

        if (dist < this.gateRadius * 1.5) { // slightly wider gate for re-acquisition
          this.residualX = rx;
          this.residualY = ry;
          this.x += this.alpha * rx;
          this.y += this.alpha * ry;
          this.vx += (this.beta / this.dt) * rx;
          this.vy += (this.beta / this.dt) * ry;
          this.coastFrames = 0;
          this.state = TrackerState.CONFIRMED;
          this.gatedOut = false;
          return this._result(true);
        } else {
          this.gatedOut = true;
          this.coastFrames++;
          if (this.coastFrames > this.coastMaxFrames) {
            this.state = TrackerState.LOST;
          }
          return this._result(false);
        }
      } else {
        this.coastFrames++;
        this.gatedOut = false;
        if (this.coastFrames > this.coastMaxFrames) {
          this.state = TrackerState.LOST;
        }
        return this._result(false);
      }
    }

    // ─── LOST ───
    if (this.state === TrackerState.LOST) {
      if (hasDetection) {
        // Re-initialize
        this.x = measX;
        this.y = measY;
        this.vx = 0;
        this.vy = 0;
        this.acquireCount = 1;
        this.lastAcquireX = measX;
        this.lastAcquireY = measY;
        this.state = TrackerState.ACQUIRING;
        this.trackAge = 0;
        this.coastFrames = 0;
        this.gatedOut = false;
        return this._result(true);
      }
      return this._result(false);
    }

    return this._result(false);
  }

  /**
   * Get current state snapshot for telemetry
   */
  getSnapshot() {
    return {
      state: this.state,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      residualX: this.residualX,
      residualY: this.residualY,
      trackAge: this.trackAge,
      coastFrames: this.coastFrames,
      acquireCount: this.acquireCount,
      acquireThreshold: this.acquireThreshold,
      gateRadius: this.gateRadius,
      gatedOut: this.gatedOut,
    };
  }

  /**
   * Reset tracker to initial state
   */
  reset() {
    this.state = TrackerState.UNINITIALIZED;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.residualX = 0;
    this.residualY = 0;
    this.trackAge = 0;
    this.coastFrames = 0;
    this.acquireCount = 0;
    this.gatedOut = false;
  }

  _result(accepted) {
    return {
      accepted,
      gated: this.gatedOut,
      state: this.state,
      position: { x: this.x, y: this.y },
      velocity: { x: this.vx, y: this.vy },
      residual: { x: this.residualX, y: this.residualY },
      trackAge: this.trackAge,
      coastFrames: this.coastFrames,
    };
  }
}

/**
 * Hybrid Perception Fusion — Safe Decision Table
 * 
 * Implements the competitor's key concept:
 * - Both detectors agree (distance < threshold) → ACCEPT classical centroid
 * - Classical-only → ACCEPT classical
 * - AI-only → REJECT (not trusted alone)
 * - Disagreement → REJECT (don't guess which is right)
 */
export const FusionDecision = {
  AGREE_ACCEPT: 'AGREE_ACCEPT',
  CLASSICAL_ONLY: 'CLASSICAL_ONLY',
  AI_ONLY_REJECT: 'AI_ONLY_REJECT',
  DISAGREE_REJECT: 'DISAGREE_REJECT',
  NO_DETECTION: 'NO_DETECTION',
};

export function resolvePerception(classicalDetection, aiDetection, agreementThreshold = 8.0) {
  const hasClassical = classicalDetection && classicalDetection.confidence > 0.5;
  const hasAI = aiDetection && aiDetection.confidence > 0.5;

  if (hasClassical && hasAI) {
    const dx = classicalDetection.x - aiDetection.x;
    const dy = classicalDetection.y - aiDetection.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= agreementThreshold) {
      return {
        decision: FusionDecision.AGREE_ACCEPT,
        centroid: { x: classicalDetection.x, y: classicalDetection.y },
        confidence: Math.max(classicalDetection.confidence, aiDetection.confidence),
        agreementDistance: dist,
      };
    } else {
      return {
        decision: FusionDecision.DISAGREE_REJECT,
        centroid: null,
        confidence: 0,
        agreementDistance: dist,
      };
    }
  }

  if (hasClassical && !hasAI) {
    return {
      decision: FusionDecision.CLASSICAL_ONLY,
      centroid: { x: classicalDetection.x, y: classicalDetection.y },
      confidence: classicalDetection.confidence,
      agreementDistance: null,
    };
  }

  if (!hasClassical && hasAI) {
    return {
      decision: FusionDecision.AI_ONLY_REJECT,
      centroid: null,
      confidence: 0,
      agreementDistance: null,
    };
  }

  return {
    decision: FusionDecision.NO_DETECTION,
    centroid: null,
    confidence: 0,
    agreementDistance: null,
  };
}
