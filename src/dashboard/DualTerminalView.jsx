import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useSimStore, TerminalPhase } from '../store/simStore';
import { getPhaseDisplayInfo } from '../sim/stateMachine';

/**
 * Dual-Terminal FSOC Tracking View — Part 4
 *
 * Shows two side-by-side tracking canvases (Terminal A and Terminal B),
 * each rendering:
 * - Search pattern reticle during SEARCHING
 * - Detection markers during LINK_ESTABLISHING
 * - Beacon crosshair during COARSE_TRACK
 * - Disturbance effects (turbulence shimmer, occlusion, glint, dropout)
 * - Phase badge with live status
 */

function TerminalCanvas({ terminalId }) {
  const canvasRef = useRef(null);
  const store = useSimStore();
  const terminal = store.terminals[terminalId];
  const phaseInfo = getPhaseDisplayInfo(terminal.phase);

  const runFrame = useCallback(() => {
    if (!store.simRunning || store.simPaused || !store.p4RunActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const ctx = canvas.getContext('2d');
    const t = store.simTime;

    // ── Background ──
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.7);
    bgGrad.addColorStop(0, '#0a0e14');
    bgGrad.addColorStop(1, '#050508');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // ── Grid ──
    ctx.strokeStyle = 'rgba(40, 50, 60, 0.25)';
    ctx.lineWidth = 0.5;
    const gridSize = 30;
    for (let x = cx % gridSize; x < W; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = cy % gridSize; y < H; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // ── Disturbance Effects ──
    const scenario = store.p4Scenario;

    // Turbulence: shimmer lines
    if (scenario === 'turbulence' || scenario === 'combined') {
      const sev = store.turbulenceSeverity;
      ctx.strokeStyle = `rgba(80, 120, 160, ${sev * 0.15})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 8 * sev; i++) {
        const y = (Math.sin(t * 3 + i * 0.7) + 1) * H / 2;
        ctx.beginPath();
        ctx.moveTo(0, y + Math.sin(t * 10 + i) * 3 * sev);
        ctx.lineTo(W, y + Math.cos(t * 8 + i) * 3 * sev);
        ctx.stroke();
      }
    }

    // Sun glint: bloom wash
    if (scenario === 'sun-glint' || scenario === 'combined') {
      const sev = store.sunGlintSeverity;
      const gx = cx + Math.sin(t * 0.3) * W * 0.3;
      const gy = cy + Math.cos(t * 0.2) * H * 0.2;
      const glintGrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, 80 * sev);
      glintGrad.addColorStop(0, `rgba(255, 255, 200, ${sev * 0.4})`);
      glintGrad.addColorStop(0.5, `rgba(255, 255, 180, ${sev * 0.15})`);
      glintGrad.addColorStop(1, 'rgba(255, 255, 180, 0)');
      ctx.fillStyle = glintGrad;
      ctx.fillRect(0, 0, W, H);
    }

    // Occlusion: dark band
    if (scenario === 'occlusion' || scenario === 'combined') {
      const sev = store.occlusionSeverity;
      const occPeriod = 8.0 / Math.max(0.1, sev);
      const occDuration = 2.0 * sev;
      const cyclePos = t % occPeriod;
      if (cyclePos < occDuration) {
        const progress = cyclePos / occDuration;
        const bandY = progress * H;
        ctx.fillStyle = `rgba(0, 0, 0, ${sev * 0.8})`;
        ctx.fillRect(0, bandY - 30, W, 60);
      }
    }

    // Dropout: static noise
    if (scenario === 'dropout' || scenario === 'combined') {
      const sev = store.dropoutSeverity;
      const dropPeriod = 10.0 / Math.max(0.1, sev);
      const dropDuration = 1.5 * sev;
      const cyclePos = t % dropPeriod;
      if (cyclePos < dropDuration) {
        // Static noise overlay
        const imageData = ctx.createImageData(W, H);
        for (let i = 0; i < imageData.data.length; i += 4) {
          const v = Math.random() * 60;
          imageData.data[i] = v;
          imageData.data[i + 1] = v;
          imageData.data[i + 2] = v;
          imageData.data[i + 3] = 180 * sev;
        }
        ctx.putImageData(imageData, 0, 0);
        // "NO SIGNAL" text
        ctx.fillStyle = '#ff3333';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SIGNAL DROPOUT', cx, cy);
        ctx.textAlign = 'start';
        return; // Don't draw anything else
      }
    }

    // ── Center crosshair ──
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 15, cy); ctx.lineTo(cx - 5, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 15, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy - 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + 15); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.stroke();

    // ── Phase-specific overlays ──

    if (terminal.phase === TerminalPhase.SEARCHING) {
      // Search pattern reticle
      const searchAngle = t * 2;
      ctx.strokeStyle = 'rgba(200, 152, 50, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      // Scanning beam
      const beamLen = Math.min(W, H) * 0.4;
      const bx = cx + Math.cos(searchAngle) * beamLen * terminal.searchProgress;
      const by = cy + Math.sin(searchAngle) * beamLen * terminal.searchProgress;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.setLineDash([]);

      // Coverage ring
      ctx.strokeStyle = 'rgba(200, 152, 50, 0.2)';
      ctx.beginPath();
      ctx.arc(cx, cy, beamLen * terminal.searchProgress, 0, Math.PI * 2);
      ctx.stroke();

      // Coverage text
      ctx.fillStyle = '#c89832';
      ctx.font = '9px monospace';
      ctx.fillText(`SCAN ${(terminal.searchProgress * 100).toFixed(0)}%`, 8, H - 8);
    }

    if (terminal.phase === TerminalPhase.LINK_ESTABLISHING || terminal.phase === TerminalPhase.COARSE_TRACK) {
      // Beacon marker at center (tracking the target)
      const jitterX = (Math.sin(t * 7) * 3 + Math.cos(t * 11) * 2) * (terminal.phase === TerminalPhase.COARSE_TRACK ? 0.5 : 1);
      const jitterY = (Math.cos(t * 5) * 3 + Math.sin(t * 9) * 2) * (terminal.phase === TerminalPhase.COARSE_TRACK ? 0.5 : 1);
      const bx = cx + jitterX;
      const by = cy + jitterY;

      // Error vector
      ctx.strokeStyle = 'rgba(0, 230, 118, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(bx, by); ctx.stroke();

      // Beacon circle
      ctx.strokeStyle = '#00e676';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, by, 10, 0, Math.PI * 2); ctx.stroke();

      // Beacon crosshair
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx - 16, by); ctx.lineTo(bx - 5, by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + 5, by); ctx.lineTo(bx + 16, by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by - 16); ctx.lineTo(bx, by - 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by + 5); ctx.lineTo(bx, by + 16); ctx.stroke();

      // Glow
      ctx.fillStyle = 'rgba(0, 230, 118, 0.12)';
      ctx.beginPath(); ctx.arc(bx, by, 18, 0, Math.PI * 2); ctx.fill();

      // Confidence
      if (terminal.cnnConfidence > 0) {
        ctx.fillStyle = '#00e676';
        ctx.font = '9px monospace';
        ctx.fillText(`CONF ${(terminal.cnnConfidence * 100).toFixed(0)}%`, 8, H - 8);
      }
    }

    if (terminal.phase === TerminalPhase.REACQUIRE) {
      // Pulsing search ring
      const pulseR = 20 + Math.sin(t * 4) * 10;
      ctx.strokeStyle = 'rgba(138, 122, 170, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(cx, cy, pulseR, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#8a7aaa';
      ctx.font = '9px monospace';
      ctx.fillText('REACQUIRING...', 8, H - 8);
    }

    // ── FOV ring ──
    ctx.strokeStyle = 'rgba(60, 70, 80, 0.25)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.arc(cx, cy, Math.min(W, H) * 0.42, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

  }, [store.simRunning, store.simPaused, store.simTime, store.p4RunActive, terminal, store.p4Scenario,
      store.turbulenceSeverity, store.occlusionSeverity, store.sunGlintSeverity, store.dropoutSeverity]);

  // Animation loop
  useEffect(() => {
    if (!store.simRunning || store.simPaused) return;
    const interval = setInterval(runFrame, 66); // ~15 FPS
    return () => clearInterval(interval);
  }, [runFrame, store.simRunning, store.simPaused]);

  // Canvas DPI
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }, []);

  return (
    <div className="p4-terminal-view">
      <canvas ref={canvasRef} className="ftv-canvas" />

      {/* Phase badge */}
      <div className="p4-terminal-badge">
        <span className="p4-terminal-id">TERMINAL {terminalId}</span>
        <span
          className={`p4-phase-badge ${phaseInfo.pulse ? 'pulse' : ''}`}
          style={{ color: phaseInfo.color, borderColor: phaseInfo.color }}
        >
          {phaseInfo.label}
        </span>
      </div>

      {/* Gimbal info */}
      <div className="p4-terminal-hud-tr">
        <div>YAW <span className="ftv-val">{(terminal.gimbalYaw * (180 / Math.PI)).toFixed(2)}</span>°</div>
        <div>PITCH <span className="ftv-val">{(terminal.gimbalPitch * (180 / Math.PI)).toFixed(2)}</span>°</div>
      </div>

      {/* Stats */}
      <div className="p4-terminal-hud-bl">
        <div>RAW {terminal.rawCandidateCount} · CONF {terminal.confirmedCandidateCount} · REJ {terminal.rejectedCandidateCount}</div>
        {terminal.reacquireCount > 0 && (
          <div style={{ color: '#8a7aaa' }}>REACQ ×{terminal.reacquireCount}</div>
        )}
      </div>
    </div>
  );
}

export default function DualTerminalView() {
  const store = useSimStore();

  if (!store.p4RunActive) {
    return (
      <div className="p4-dual-terminal-container p4-empty">
        <div className="p4-empty-label">
          Start a Part 4 run to activate dual-terminal tracking
        </div>
      </div>
    );
  }

  return (
    <div className="p4-dual-terminal-container">
      <TerminalCanvas terminalId="A" />
      <TerminalCanvas terminalId="B" />

      {/* Link status overlay */}
      {store.linkEstablished && (
        <div className="p4-link-established-banner">
          <span className="p4-link-beam-icon">⟷</span>
          LINK ESTABLISHED — T+{store.linkEstablishedT?.toFixed(1)}s
        </div>
      )}
      {!store.linkEstablished && store.dualLockSince !== null && (
        <div className="p4-link-dwell-banner">
          DWELL — {((store.simTime - store.dualLockSince) / store.linkDwellSeconds * 100).toFixed(0)}%
        </div>
      )}
    </div>
  );
}
