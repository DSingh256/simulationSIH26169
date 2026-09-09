import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useSimStore } from '../store/simStore';
import { AlphaBetaTracker, TrackerState, resolvePerception, FusionDecision } from '../sim/alphaBetaTracker';
import { PIDController } from '../sim/pid';

/**
 * FSOC Tracking View — Live closed-loop visualization
 * 
 * Replicates the competitor's tracking view:
 * - Dark background with center crosshair (current aim)
 * - Green beacon marker at detected position
 * - Error vector line from crosshair to beacon
 * - Full HUD overlay: state, pan/tilt, detection, PID commands
 * - Real closed-loop: Detector → Fusion → Tracker → PID → Pan/Tilt
 */

// Dedicated tracker + PID instances for this view
const tracker = new AlphaBetaTracker({
  alpha: 0.85, beta: 0.005, gateRadius: 60,
  acquireThreshold: 5, coastMaxFrames: 30,
});
const pidPan = new PIDController(0.15, 0.008, 0.06);
const pidTilt = new PIDController(0.15, 0.008, 0.06);

export default function FSOCTrackingView() {
  const canvasRef = useRef(null);
  const store = useSimStore();
  const frameRef = useRef(0);

  const [hud, setHud] = useState({
    trackingState: 'SEARCHING',
    visible: false,
    detected: false,
    simTime: 0,
    frame: 0,
    // Detection
    detX: 0, detY: 0,
    errPxX: 0, errPxY: 0,
    confidence: 0,
    // Pan/Tilt
    panDeg: 0, tiltDeg: 0,
    angErr: 0,
    // PID commands
    cmdPan: 0, cmdTilt: 0,
    panRateLimit: false,
    tiltRateLimit: false,
    // Fusion
    fusionDecision: 'NO_DETECTION',
    // Tracker
    trackerState: 'UNINITIALIZED',
    gatePass: true,
    coastFrames: 0,
  });

  // Accumulated pan/tilt state
  const panTiltRef = useRef({ pan: 0, tilt: 0 });

  const runFrame = useCallback(() => {
    if (!store.simRunning || store.simPaused) return;

    const t = store.simTime;
    const link0 = store.links[0] || {};
    const uav0 = store.uavs[0];
    const envProfile = store.envProfile || {};
    const noise = envProfile.noiseBase ?? 0.1;
    const turbulence = envProfile.turbulenceBase ?? 0.1;
    const isLost = link0.state === 'LOST';
    const isLocked = link0.state === 'LOCKED';

    frameRef.current++;

    // ── Canvas dimensions ──
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    // ── Beacon true position (simulated moving target) ──
    const beaconTrueX = cx + Math.sin(t * 0.7) * 120 + Math.cos(t * 1.3) * 40;
    const beaconTrueY = cy + Math.cos(t * 0.5) * 80 + Math.sin(t * 1.1) * 30;

    // ── Classical Detector ──
    const classicalNoise = (noise + turbulence) * 12;
    const classicalVisible = !isLost && (Math.sin(t * 0.3) > -0.9);
    const classical = classicalVisible ? {
      x: beaconTrueX + (Math.sin(t * 7.3) * classicalNoise),
      y: beaconTrueY + (Math.cos(t * 5.1) * classicalNoise),
      confidence: isLocked ? 0.88 + Math.sin(t * 2) * 0.05 : 0.55 + Math.sin(t) * 0.15,
    } : null;

    // ── AI Detector (TinyBeaconNet simulation) ──
    const aiActive = !isLost && (Math.sin(t * 1.3) > -0.5);
    const aiNoise = noise * 5;
    const ai = aiActive ? {
      x: beaconTrueX + (Math.sin(t * 7.3 + 0.1) * aiNoise),
      y: beaconTrueY + (Math.cos(t * 5.1 + 0.1) * aiNoise),
      confidence: isLocked ? 0.78 + Math.sin(t * 1.5) * 0.08 : 0.4 + Math.sin(t * 0.7) * 0.12,
    } : null;

    // ── Safe Hybrid Fusion ──
    const fusion = resolvePerception(classical, ai, 8.0);

    // ── Alpha-Beta Tracker ──
    const measX = fusion.centroid ? fusion.centroid.x : null;
    const measY = fusion.centroid ? fusion.centroid.y : null;
    const trackerResult = tracker.update(measX, measY);

    // ── Control Safety ──
    const isSafeToSteer = trackerResult.state === TrackerState.CONFIRMED ||
      (trackerResult.state === TrackerState.COASTING && trackerResult.coastFrames < 10);

    // ── PID Controller ──
    let cmdPan = 0, cmdTilt = 0;
    const MAX_RATE = 30.0; // deg/s

    if (isSafeToSteer) {
      const errX = (trackerResult.position.x - cx) / W; // normalized
      const errY = (trackerResult.position.y - cy) / H;
      cmdPan = pidPan.update(errX, 1 / 15) * 200;  // scale to deg/s
      cmdTilt = pidTilt.update(errY, 1 / 15) * 200;
    } else {
      pidPan.reset();
      pidTilt.reset();
    }

    // ── Rate Limiting (Saturating Virtual Gimbal) ──
    const panRateLimit = Math.abs(cmdPan) > MAX_RATE;
    const tiltRateLimit = Math.abs(cmdTilt) > MAX_RATE;
    cmdPan = Math.max(-MAX_RATE, Math.min(MAX_RATE, cmdPan));
    cmdTilt = Math.max(-MAX_RATE, Math.min(MAX_RATE, cmdTilt));

    // ── Pan/Tilt Actuator ──
    const pt = panTiltRef.current;
    pt.pan += cmdPan * (1 / 15);
    pt.tilt += cmdTilt * (1 / 15);

    // ── Pixel error ──
    const detX = trackerResult.position.x;
    const detY = trackerResult.position.y;
    const errPxX = detX - cx;
    const errPxY = detY - cy;
    const angErr = Math.sqrt(errPxX * errPxX + errPxY * errPxY) * 0.01; // approx degrees

    // ── Tracking state derivation ──
    let trackingState = 'SEARCHING';
    if (trackerResult.state === TrackerState.CONFIRMED) trackingState = 'TRACKING';
    else if (trackerResult.state === TrackerState.COASTING) trackingState = 'COASTING';
    else if (trackerResult.state === TrackerState.ACQUIRING) trackingState = 'ACQUIRING';
    else if (trackerResult.state === TrackerState.LOST) trackingState = 'LOST';

    // ── Update HUD ──
    setHud({
      trackingState,
      visible: classicalVisible || aiActive,
      detected: fusion.centroid !== null,
      simTime: t,
      frame: frameRef.current,
      detX: detX.toFixed(1), detY: detY.toFixed(1),
      errPxX: errPxX.toFixed(1), errPxY: errPxY.toFixed(1),
      confidence: (fusion.confidence * 100).toFixed(0),
      panDeg: pt.pan.toFixed(3), tiltDeg: pt.tilt.toFixed(3),
      angErr: angErr.toFixed(4),
      cmdPan: cmdPan.toFixed(1), cmdTilt: cmdTilt.toFixed(1),
      panRateLimit, tiltRateLimit,
      fusionDecision: fusion.decision,
      trackerState: trackerResult.state,
      gatePass: !trackerResult.gated,
      coastFrames: trackerResult.coastFrames,
    });

    // ══════════════════════════════════════
    //   RENDER THE TRACKING VIEW ON CANVAS
    // ══════════════════════════════════════
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // Background
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.7);
    bgGrad.addColorStop(0, '#0a0e14');
    bgGrad.addColorStop(1, '#050508');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(40, 50, 60, 0.3)';
    ctx.lineWidth = 0.5;
    const gridSize = 40;
    for (let x = cx % gridSize; x < W; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = cy % gridSize; y < H; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Center crosshair (current aim point)
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.lineWidth = 1;
    // Horizontal
    ctx.beginPath(); ctx.moveTo(cx - 20, cy); ctx.lineTo(cx - 6, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 6, cy); ctx.lineTo(cx + 20, cy); ctx.stroke();
    // Vertical
    ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy - 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy + 6); ctx.lineTo(cx, cy + 20); ctx.stroke();
    // Circle
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.stroke();

    // FOV boundary ring
    ctx.strokeStyle = 'rgba(60, 70, 80, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(cx, cy, Math.min(W, H) * 0.42, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    // ── Beacon (detected position) ──
    if (fusion.centroid) {
      const bx = fusion.centroid.x;
      const by = fusion.centroid.y;

      // Error vector line
      ctx.strokeStyle = 'rgba(0, 230, 118, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(bx, by);
      ctx.stroke();

      // Beacon marker (green circle + crosshair)
      ctx.strokeStyle = '#00e676';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, by, 12, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx - 18, by); ctx.lineTo(bx - 6, by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + 6, by); ctx.lineTo(bx + 18, by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by - 18); ctx.lineTo(bx, by - 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by + 6); ctx.lineTo(bx, by + 18); ctx.stroke();

      // Beacon glow
      ctx.fillStyle = 'rgba(0, 230, 118, 0.15)';
      ctx.beginPath(); ctx.arc(bx, by, 20, 0, Math.PI * 2); ctx.fill();
    }

    // ── Tracker predicted position (if coasting) ──
    if (trackerResult.state === TrackerState.COASTING) {
      const px = trackerResult.position.x;
      const py = trackerResult.position.y;
      ctx.strokeStyle = 'rgba(138, 122, 170, 0.7)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(px, py, 15, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      // Velocity arrow
      const vScale = 5;
      ctx.strokeStyle = 'rgba(138, 122, 170, 0.5)';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + trackerResult.velocity.x * vScale, py + trackerResult.velocity.y * vScale);
      ctx.stroke();
    }

    // ── Gate radius visualization ──
    if (trackerResult.state !== TrackerState.UNINITIALIZED && trackerResult.state !== TrackerState.LOST) {
      ctx.strokeStyle = 'rgba(90, 138, 180, 0.15)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.arc(trackerResult.position.x, trackerResult.position.y, tracker.gateRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

  }, [store.simRunning, store.simPaused, store.simTime, store.links, store.uavs, store.envProfile]);

  // Animation loop
  useEffect(() => {
    if (!store.simRunning || store.simPaused) return;
    const interval = setInterval(runFrame, 66); // ~15 FPS
    return () => clearInterval(interval);
  }, [runFrame, store.simRunning, store.simPaused]);

  // Set canvas DPI
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }, []);

  const stateColor = {
    TRACKING: '#00e676', ACQUIRING: '#c89832',
    COASTING: '#8a7aaa', SEARCHING: '#c43a3a', LOST: '#c43a3a',
  }[hud.trackingState] || '#c43a3a';

  return (
    <div className="fsoc-tracking-view">
      <canvas ref={canvasRef} className="ftv-canvas" />

      {/* ── TOP-LEFT HUD ── */}
      <div className="ftv-hud ftv-hud-tl">
        <div className="ftv-hud-title">SIH26169 | FSOC TRACKING</div>
        <div className="ftv-hud-state" style={{ color: stateColor }}>{hud.trackingState}</div>
        <div>VISIBLE  {hud.visible ? 'YES' : 'NO'}</div>
        <div>DETECTED {hud.detected ? 'YES' : 'NO'}</div>
        <div>SIM  {parseFloat(hud.simTime).toFixed(3)} s</div>
        <div>FRAME {hud.frame}</div>
        <div style={{ marginTop: 4, fontSize: '9px', color: '#5a8ab4' }}>
          FUSION: {hud.fusionDecision.replace(/_/g, ' ')}
        </div>
        <div style={{ fontSize: '9px', color: '#5a9a9a' }}>
          TRACKER: {hud.trackerState} {hud.gatePass ? '' : '· GATED'}
        </div>
      </div>

      {/* ── TOP-RIGHT HUD ── */}
      <div className="ftv-hud ftv-hud-tr">
        <div>PAN  <span className="ftv-val">{hud.panDeg > 0 ? '+' : ''}{hud.panDeg}</span> deg</div>
        <div>TILT <span className="ftv-val">{hud.tiltDeg > 0 ? '+' : ''}{hud.tiltDeg}</span> deg</div>
        <div style={{ color: '#00e676' }}>ANG ERR {hud.angErr} deg</div>
      </div>

      {/* ── BOTTOM-LEFT HUD ── */}
      <div className="ftv-hud ftv-hud-bl">
        <div>DET ({hud.detX}, {hud.detY})</div>
        <div style={{ color: '#00e676' }}>
          ERR PX X {hud.errPxX > 0 ? '+' : ''}{hud.errPxX}  Y {hud.errPxY > 0 ? '+' : ''}{hud.errPxY}
        </div>
        <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
          CONF {hud.confidence}%
        </div>
      </div>

      {/* ── BOTTOM-RIGHT HUD ── */}
      <div className="ftv-hud ftv-hud-br">
        <div style={{ color: '#00e676' }}>
          CMD PAN  {hud.cmdPan > 0 ? '+' : ''}{hud.cmdPan} deg/s
        </div>
        <div>CMD TILT {hud.cmdTilt > 0 ? '+' : ''}{hud.cmdTilt} deg/s</div>
        {hud.panRateLimit && <div className="ftv-rate-warn">PAN RATE LIMIT</div>}
        {hud.tiltRateLimit && <div className="ftv-rate-warn">TILT RATE LIMIT</div>}
        {hud.coastFrames > 0 && (
          <div style={{ color: '#8a7aaa', fontSize: '9px' }}>COAST {hud.coastFrames}</div>
        )}
      </div>
    </div>
  );
}
