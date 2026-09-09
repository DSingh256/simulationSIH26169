/**
 * Dual-Terminal Simulation Engine — Part 4
 * 
 * Core simulation tick for both terminals:
 * Per-terminal: search pattern → detection simulation → CNN filter →
 *   tracker state → PID → gimbal → link state
 * 
 * Called from MissionWorld.jsx useFrame loop.
 */

import { TerminalPhase, DetectorMode } from '../store/simStore';
import { getSearchSetpoint } from './searchPattern';
import { getSimRNG } from './seededRandom';

const DEPLOY_DELAY = 0.5; // seconds before transitioning from DEPLOYED to SEARCHING

/**
 * Simulates one terminal's detection of the other terminal.
 * Uses the degraded sensor feed parameters (disturbances) to determine
 * whether the target is visible and what the detection confidence is.
 *
 * @param {object} selfUav - the observing terminal's UAV data
 * @param {object} targetUav - the target terminal's UAV data
 * @param {object} termState - the observing terminal's state
 * @param {object} store - the sim store state
 * @param {object} rng - seeded RNG
 * @returns {object} { detected, confidence, rawCandidates, confirmedCandidates, rejectedCandidates }
 */
function simulateDetection(selfUav, targetUav, termState, store, rng) {
  const dx = targetUav.position[0] - selfUav.position[0];
  const dy = targetUav.position[1] - selfUav.position[1];
  const dz = targetUav.position[2] - selfUav.position[2];
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Calculate bearing to target from current gimbal pose
  const bearingYaw = Math.atan2(dx, dz);
  const bearingPitch = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));

  // How far off is the gimbal from the target bearing?
  const yawErr = Math.abs(bearingYaw - termState.gimbalYaw);
  const pitchErr = Math.abs(bearingPitch - termState.gimbalPitch);
  const angularOffset = Math.sqrt(yawErr * yawErr + pitchErr * pitchErr);

  // FOV half-angle (radians) — ~3 degrees
  const fovHalf = (store.fov || 3) * (Math.PI / 180);

  // Target must be within FOV to detect
  if (angularOffset > fovHalf) {
    return { detected: false, confidence: 0, rawCandidates: 0, confirmedCandidates: 0, rejectedCandidates: 0 };
  }

  // Base detection probability based on angular offset and distance
  let detectProb = Math.max(0.1, 1.0 - (angularOffset / fovHalf) * 0.5 - dist * 0.0001);

  // Apply disturbance degradation
  const scenario = store.p4Scenario;
  let degradation = 0;

  if (scenario === 'turbulence' || scenario === 'combined') {
    degradation += store.turbulenceSeverity * 0.3;
  }
  if (scenario === 'occlusion' || scenario === 'combined') {
    // Periodic occlusion — cloud passes through at intervals
    const occPeriod = 8.0 / Math.max(0.1, store.occlusionSeverity);
    const occDuration = 2.0 * store.occlusionSeverity;
    const cyclePos = store.simTime % occPeriod;
    if (cyclePos < occDuration) {
      // Occluded!
      return { detected: false, confidence: 0, rawCandidates: 0, confirmedCandidates: 0, rejectedCandidates: 0, occluded: true };
    }
  }
  if (scenario === 'sun-glint' || scenario === 'combined') {
    degradation += store.sunGlintSeverity * 0.25;
  }
  if (scenario === 'dropout' || scenario === 'combined') {
    // Signal dropout — periodic freeze
    const dropPeriod = 10.0 / Math.max(0.1, store.dropoutSeverity);
    const dropDuration = 1.5 * store.dropoutSeverity;
    const cyclePos = store.simTime % dropPeriod;
    if (cyclePos < dropDuration) {
      return { detected: false, confidence: 0, rawCandidates: 0, confirmedCandidates: 0, rejectedCandidates: 0, dropout: true };
    }
  }

  detectProb -= degradation;
  detectProb = Math.max(0, Math.min(1, detectProb));

  // Raw blob detection
  const detected = rng.next() < detectProb;
  let rawCandidates = detected ? 1 : 0;

  // False positive blobs from noise/glint
  const fpProb = (scenario === 'sun-glint' || scenario === 'combined')
    ? 0.3 * store.sunGlintSeverity
    : 0.05;
  if (rng.next() < fpProb) rawCandidates++;

  // CNN/classifier filter
  let confirmedCandidates = 0;
  let rejectedCandidates = 0;
  let finalConfidence = 0;

  if (store.detectorMode === DetectorMode.BLOB_CNN) {
    // CNN confirms true detection, rejects most false positives
    if (detected) {
      const cnnConf = 0.7 + rng.next() * 0.25 - degradation * 0.2;
      if (cnnConf > store.cnnConfidenceThreshold) {
        confirmedCandidates = 1;
        finalConfidence = cnnConf;
      } else {
        rejectedCandidates = 1;
      }
    }
    // Reject false positives
    rejectedCandidates += rawCandidates - (detected ? 1 : 0);
  } else {
    // blob_only — no CNN, use raw blob
    if (detected) {
      confirmedCandidates = 1;
      finalConfidence = 0.6 + rng.next() * 0.3 - degradation * 0.15;
    }
  }

  return {
    detected: confirmedCandidates > 0,
    confidence: finalConfidence,
    rawCandidates,
    confirmedCandidates,
    rejectedCandidates,
  };
}

/**
 * Main simulation tick — called every frame from MissionWorld.
 * Updates both terminals' state through the full lifecycle.
 */
export function tickTerminalSimulation(store, dt) {
  if (!store.p4RunActive) return;

  const rng = getSimRNG();
  const simTime = store.simTime;
  const termA = store.terminals.A;
  const termB = store.terminals.B;
  const uavA = store.uavs[0];
  const uavB = store.uavs[1];

  if (!uavA || !uavB) return;

  // Process each terminal
  const updateA = tickOneTerminal('A', termA, uavA, uavB, store, dt, rng);
  const updateB = tickOneTerminal('B', termB, uavB, uavA, store, dt, rng);

  // Apply terminal updates
  if (updateA) store.updateTerminal('A', updateA);
  if (updateB) store.updateTerminal('B', updateB);

  // Aggregate metrics
  const rawTotal = (updateA?.rawCandidateCount || termA.rawCandidateCount) +
                   (updateB?.rawCandidateCount || termB.rawCandidateCount);
  const rejTotal = (updateA?.rejectedCandidateCount || termA.rejectedCandidateCount) +
                   (updateB?.rejectedCandidateCount || termB.rejectedCandidateCount);

  store.updateP4Metrics({
    totalRawCandidates: rawTotal,
    totalRejectedCandidates: rejTotal,
    falsePositiveRate: rawTotal > 0 ? rejTotal / rawTotal : 0,
  });

  // ── Link Establishment Logic ──
  updateLinkState(store, simTime);
}

function tickOneTerminal(id, term, selfUav, targetUav, store, dt, rng) {
  const simTime = store.simTime;
  const update = {};

  switch (term.phase) {
    case TerminalPhase.DEPLOYED: {
      // Wait for deployment delay then start searching
      if (simTime > DEPLOY_DELAY) {
        update.phase = TerminalPhase.SEARCHING;
        update.searchStartTime = simTime;
        store.addEvent(`Terminal ${id}: DEPLOYED → SEARCHING`);
      }
      break;
    }

    case TerminalPhase.SEARCHING: {
      // Drive gimbal with search pattern
      const elapsed = simTime - term.searchStartTime;
      const sp = getSearchSetpoint(store.searchPattern, elapsed, {
        fovWidth: 1.2,
        fovHeight: 1.0,
        speed: store.searchSpeed,
      });

      update.searchYaw = sp.yaw;
      update.searchPitch = sp.pitch;
      update.searchProgress = sp.coverage;
      update.gimbalYaw = sp.yaw;
      update.gimbalPitch = sp.pitch;

      // Run detection
      const det = simulateDetection(selfUav, targetUav, { ...term, ...update }, store, rng);
      update.rawCandidateCount = term.rawCandidateCount + det.rawCandidates;
      update.confirmedCandidateCount = term.confirmedCandidateCount + det.confirmedCandidates;
      update.rejectedCandidateCount = term.rejectedCandidateCount + det.rejectedCandidates;

      if (det.detected && det.confidence > store.cnnConfidenceThreshold) {
        update.phase = TerminalPhase.LINK_ESTABLISHING;
        update.detectionResult = det;
        update.cnnConfidence = det.confidence;
        update.lockStartT = simTime;
        update.consecutiveLockFrames = 1;

        // Calculate bearing to target for gimbal slew
        const dx = targetUav.position[0] - selfUav.position[0];
        const dz = targetUav.position[2] - selfUav.position[2];
        const dy = targetUav.position[1] - selfUav.position[1];
        update.gimbalYaw = Math.atan2(dx, dz);
        update.gimbalPitch = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));

        store.addEvent(`Terminal ${id}: SEARCHING → LINK_ESTABLISHING (conf: ${det.confidence.toFixed(2)})`);
      }
      break;
    }

    case TerminalPhase.LINK_ESTABLISHING: {
      // Slew gimbal toward target bearing using PID-like tracking
      const dx = targetUav.position[0] - selfUav.position[0];
      const dz = targetUav.position[2] - selfUav.position[2];
      const dy = targetUav.position[1] - selfUav.position[1];
      const targetYaw = Math.atan2(dx, dz);
      const targetPitch = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));

      // Smooth slew
      update.gimbalYaw = term.gimbalYaw + (targetYaw - term.gimbalYaw) * Math.min(1, dt * 3);
      update.gimbalPitch = term.gimbalPitch + (targetPitch - term.gimbalPitch) * Math.min(1, dt * 3);

      // Continue detection
      const det = simulateDetection(selfUav, targetUav, { ...term, ...update }, store, rng);
      update.rawCandidateCount = term.rawCandidateCount + det.rawCandidates;
      update.confirmedCandidateCount = term.confirmedCandidateCount + det.confirmedCandidates;
      update.rejectedCandidateCount = term.rejectedCandidateCount + det.rejectedCandidates;
      update.detectionResult = det;
      update.cnnConfidence = det.confidence;

      if (det.detected) {
        update.consecutiveLockFrames = term.consecutiveLockFrames + 1;
        update.confirmedLock = term.consecutiveLockFrames * dt >= store.lockHoldSeconds;
      } else {
        update.consecutiveLockFrames = Math.max(0, term.consecutiveLockFrames - 2);
        if (term.consecutiveLockFrames <= 0) {
          // Lost during establishing — back to search
          update.phase = TerminalPhase.SEARCHING;
          update.searchStartTime = simTime;
          update.confirmedLock = false;
          store.addEvent(`Terminal ${id}: LINK_ESTABLISHING → SEARCHING (lock lost)`);
        }
      }
      break;
    }

    case TerminalPhase.COARSE_TRACK: {
      // Continue tracking — slew gimbal to target
      const dx = targetUav.position[0] - selfUav.position[0];
      const dz = targetUav.position[2] - selfUav.position[2];
      const dy = targetUav.position[1] - selfUav.position[1];
      const targetYaw = Math.atan2(dx, dz);
      const targetPitch = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));

      update.gimbalYaw = term.gimbalYaw + (targetYaw - term.gimbalYaw) * Math.min(1, dt * 5);
      update.gimbalPitch = term.gimbalPitch + (targetPitch - term.gimbalPitch) * Math.min(1, dt * 5);

      // Detection
      const det = simulateDetection(selfUav, targetUav, { ...term, ...update }, store, rng);
      update.rawCandidateCount = term.rawCandidateCount + det.rawCandidates;
      update.confirmedCandidateCount = term.confirmedCandidateCount + det.confirmedCandidates;
      update.rejectedCandidateCount = term.rejectedCandidateCount + det.rejectedCandidates;
      update.detectionResult = det;

      // Tracking error for RMSE
      const angErr = Math.sqrt(
        (targetYaw - (update.gimbalYaw || term.gimbalYaw)) ** 2 +
        (targetPitch - (update.gimbalPitch || term.gimbalPitch)) ** 2
      );

      // Add to tracking samples
      const samples = store.p4Metrics.trackingSamples;
      if (samples.length < 5000) {
        store.updateP4Metrics({
          trackingSamples: [...samples, angErr],
        });
      }

      if (!det.detected) {
        // Lost tracking — enter reacquire
        update.phase = TerminalPhase.REACQUIRE;
        update.reacquireStartT = simTime;
        update.reacquireCount = term.reacquireCount + 1;
        update.confirmedLock = false;
        store.addEvent(`Terminal ${id}: COARSE_TRACK → REACQUIRE`);

        // Log disturbance event if applicable
        if (det.occluded) {
          store.addDisturbanceEvent({
            type: 'occlusion',
            terminal: id,
            start_t: simTime,
            severity: store.occlusionSeverity,
          });
        } else if (det.dropout) {
          store.addDisturbanceEvent({
            type: 'dropout',
            terminal: id,
            start_t: simTime,
            severity: store.dropoutSeverity,
          });
        }
      }
      break;
    }

    case TerminalPhase.REACQUIRE: {
      // Spiral search from last known position
      const elapsed = simTime - term.reacquireStartT;
      const sp = getSearchSetpoint('spiral', elapsed, {
        maxRadius: 0.3,
        speed: 3.0,
        expansionRate: 0.05,
      });

      // Spiral centered on last known gimbal direction
      update.gimbalYaw = term.gimbalYaw + sp.yaw * 0.1;
      update.gimbalPitch = term.gimbalPitch + sp.pitch * 0.1;
      update.searchProgress = sp.coverage;

      // Detection
      const det = simulateDetection(selfUav, targetUav, { ...term, ...update }, store, rng);
      update.rawCandidateCount = term.rawCandidateCount + det.rawCandidates;
      update.confirmedCandidateCount = term.confirmedCandidateCount + det.confirmedCandidates;
      update.rejectedCandidateCount = term.rejectedCandidateCount + det.rejectedCandidates;
      update.detectionResult = det;

      if (det.detected) {
        update.phase = TerminalPhase.COARSE_TRACK;
        update.confirmedLock = true;
        const reacqTime = simTime - term.reacquireStartT;
        update.reacquireTimes = [...term.reacquireTimes, reacqTime];
        store.addEvent(`Terminal ${id}: REACQUIRE → COARSE_TRACK (${reacqTime.toFixed(1)}s)`);
      } else if (elapsed > 10) {
        // Timeout — back to full search
        update.phase = TerminalPhase.SEARCHING;
        update.searchStartTime = simTime;
        store.addEvent(`Terminal ${id}: REACQUIRE timeout → SEARCHING`);
      }
      break;
    }

    default:
      break;
  }

  return Object.keys(update).length > 0 ? update : null;
}

/**
 * Check if both terminals have confirmed locks and apply dwell logic.
 */
function updateLinkState(store, now) {
  if (store.linkEstablished) return; // Already established

  const termA = store.terminals.A;
  const termB = store.terminals.B;

  const bothLocked = termA.confirmedLock && termB.confirmedLock;

  if (!bothLocked) {
    if (store.dualLockSince !== null) {
      store.setDualLockSince(null);
    }
    return;
  }

  if (store.dualLockSince === null) {
    store.setDualLockSince(now);
    store.addEvent('Dual lock detected — dwell timer started');
    return;
  }

  if (now - store.dualLockSince >= store.linkDwellSeconds) {
    // LINK ESTABLISHED!
    store.setLinkEstablished(now);
    store.updateTerminal('A', { phase: TerminalPhase.COARSE_TRACK });
    store.updateTerminal('B', { phase: TerminalPhase.COARSE_TRACK });
    store.addEvent(`LINK ESTABLISHED at T+${now.toFixed(1)}s — both terminals COARSE_TRACK`);
  }
}
