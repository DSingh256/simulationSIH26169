import React, { useState, useEffect } from 'react';
import { useSimStore } from '../store/simStore';

/**
 * Pipeline Flow Diagram — Live architecture visualization
 * 
 * Replicates the competitor's architecture diagram showing:
 * Trajectory → Synthetic Camera → Image Disturbance → 
 *   Classical Detector + TinyBeaconNet → Safe Hybrid Fusion →
 *   TargetTracker → Control Safety → PID Controller → Pan/Tilt Actuator
 * 
 * Each node shows live status (active/idle/error) driven by real sim state.
 */

const PIPELINE_NODES = [
  { id: 'env', label: 'Trajectory / Environment', group: 'sim', x: 60, y: 30 },
  { id: 'cam', label: 'Synthetic Camera', sublabel: 'SyntheticCameraRenderer', group: 'sim', x: 200, y: 100 },
  { id: 'dist', label: 'Image Disturbance', sublabel: 'noise / clutter / occlusion', group: 'sim', x: 200, y: 180 },
  { id: 'classical', label: 'Classical Detector', sublabel: 'threshold + centroid', group: 'detect', x: 90, y: 270 },
  { id: 'cnn', label: 'TinyBeaconNet', sublabel: 'CNN, ONNX, inference', group: 'detect', x: 310, y: 270 },
  { id: 'fusion', label: 'Safe Hybrid Fusion', sublabel: 'resolve_perception, ADR-018', group: 'fusion', x: 200, y: 360 },
  { id: 'tracker', label: 'TargetTracker', sublabel: 'alpha-beta + temporal gate, ADR-019', group: 'track', x: 200, y: 440 },
  { id: 'safety', label: 'Control Safety', sublabel: 'is_safe_to_steer', group: 'control', x: 200, y: 520 },
  { id: 'pid', label: 'PID Controller', sublabel: 'pan/tilt correction', group: 'control', x: 200, y: 600 },
  { id: 'actuator', label: 'Pan / Tilt Actuator', sublabel: 'PanTiltCamera', group: 'output', x: 200, y: 680 },
];

const PIPELINE_EDGES = [
  { from: 'env', to: 'cam' },
  { from: 'cam', to: 'dist' },
  { from: 'dist', to: 'classical' },
  { from: 'dist', to: 'cnn' },
  { from: 'classical', to: 'fusion' },
  { from: 'cnn', to: 'fusion' },
  { from: 'fusion', to: 'tracker' },
  { from: 'tracker', to: 'safety' },
  { from: 'safety', to: 'pid' },
  { from: 'pid', to: 'actuator' },
  { from: 'actuator', to: 'cam', label: 'next frame', style: 'feedback' },
];

const GROUP_COLORS = {
  sim: { border: '#3a5a4a', bg: 'rgba(58, 90, 74, 0.08)', text: '#5a9a7a' },
  detect: { border: '#5a5a8a', bg: 'rgba(90, 90, 138, 0.08)', text: '#7a7aaa' },
  fusion: { border: '#8a6a3a', bg: 'rgba(138, 106, 58, 0.08)', text: '#c89832' },
  track: { border: '#3a6a8a', bg: 'rgba(58, 106, 138, 0.08)', text: '#5a8ab4' },
  control: { border: '#5a3a6a', bg: 'rgba(90, 58, 106, 0.08)', text: '#8a6aaa' },
  output: { border: '#2a5a5a', bg: 'rgba(42, 90, 90, 0.08)', text: '#5a9a9a' },
};

function getNodeStatus(nodeId, store) {
  const isRunning = store.simRunning && !store.simPaused;
  const link0 = store.links[0] || {};
  const isLost = link0.state === 'LOST';

  if (!isRunning) return 'idle';

  switch (nodeId) {
    case 'env': return 'active';
    case 'cam': return 'active';
    case 'dist': return (store.noiseStrength > 0.3 || store.turbulenceStrength > 0.3) ? 'warning' : 'active';
    case 'classical': return isLost ? 'error' : 'active';
    case 'cnn': return isLost ? 'error' : 'active';
    case 'fusion': return isLost ? 'error' : 'active';
    case 'tracker': return isLost ? 'error' : 'active';
    case 'safety': return isLost ? 'blocked' : 'active';
    case 'pid': return isLost ? 'idle' : 'active';
    case 'actuator': return isLost ? 'idle' : 'active';
    default: return 'idle';
  }
}

const STATUS_COLORS = {
  active: '#4ca854',
  warning: '#c89832',
  error: '#c43a3a',
  blocked: '#c87832',
  idle: '#4a4844',
};

export default function PipelineDiagram() {
  const store = useSimStore();
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (!store.simRunning || store.simPaused) return;
    const interval = setInterval(() => setPulse(p => p + 1), 500);
    return () => clearInterval(interval);
  }, [store.simRunning, store.simPaused]);

  const svgW = 460;
  const svgH = 740;

  return (
    <div className="pipeline-diagram">
      <div className="pd-header">
        <div className="pd-title">Pipeline Architecture</div>
        <div className="pd-subtitle">SIMULATION ENVIRONMENT — this repository, today</div>
      </div>

      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" className="pd-svg">
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="rgba(120,120,120,0.6)" />
          </marker>
          <marker id="arrowhead-feedback" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="rgba(90,154,154,0.4)" />
          </marker>
        </defs>

        {/* ── Edges ── */}
        {PIPELINE_EDGES.map((edge, i) => {
          const fromNode = PIPELINE_NODES.find(n => n.id === edge.from);
          const toNode = PIPELINE_NODES.find(n => n.id === edge.to);
          if (!fromNode || !toNode) return null;

          const fx = fromNode.x + 80;
          const fy = fromNode.y + 22;
          const tx = toNode.x + 80;
          const ty = toNode.y;

          if (edge.style === 'feedback') {
            // Feedback loop — curve around the right side
            return (
              <g key={i}>
                <path
                  d={`M ${fx + 80} ${fy} C ${svgW - 20} ${fy}, ${svgW - 20} ${ty}, ${tx + 80} ${ty}`}
                  fill="none" stroke="rgba(90,154,154,0.25)" strokeWidth="1"
                  strokeDasharray="4 4" markerEnd="url(#arrowhead-feedback)"
                />
                {edge.label && (
                  <text x={svgW - 40} y={(fy + ty) / 2} fill="rgba(90,154,154,0.5)"
                    fontSize="9" textAnchor="middle" fontStyle="italic">{edge.label}</text>
                )}
              </g>
            );
          }

          // Determine if from/to have different x positions
          const isStraight = Math.abs(fx - tx) < 10;

          return (
            <g key={i}>
              {isStraight ? (
                <line x1={fx} y1={fy} x2={tx} y2={ty}
                  stroke="rgba(120,120,120,0.4)" strokeWidth="1"
                  markerEnd="url(#arrowhead)" />
              ) : (
                <path
                  d={`M ${fx} ${fy} C ${fx} ${(fy + ty) / 2}, ${tx} ${(fy + ty) / 2}, ${tx} ${ty}`}
                  fill="none" stroke="rgba(120,120,120,0.4)" strokeWidth="1"
                  markerEnd="url(#arrowhead)" />
              )}
            </g>
          );
        })}

        {/* ── Nodes ── */}
        {PIPELINE_NODES.map(node => {
          const status = getNodeStatus(node.id, store);
          const statusColor = STATUS_COLORS[status];
          const colors = GROUP_COLORS[node.group];
          const nodeW = 160;
          const nodeH = node.sublabel ? 44 : 28;
          const isActive = status === 'active' || status === 'warning';

          return (
            <g key={node.id}>
              {/* Node background */}
              <rect
                x={node.x} y={node.y}
                width={nodeW} height={nodeH}
                rx="4" ry="4"
                fill={colors.bg}
                stroke={isActive ? statusColor : colors.border}
                strokeWidth={isActive ? 1.5 : 0.8}
                opacity={status === 'idle' ? 0.5 : 1}
              />

              {/* Status dot */}
              <circle
                cx={node.x + 10} cy={node.y + (node.sublabel ? 14 : nodeH / 2)}
                r="3" fill={statusColor}
                opacity={isActive && pulse % 2 === 0 ? 1 : 0.6}
              />

              {/* Label */}
              <text
                x={node.x + 18} y={node.y + (node.sublabel ? 16 : nodeH / 2 + 4)}
                fill={colors.text} fontSize="10" fontWeight="600"
                fontFamily="'JetBrains Mono', monospace"
              >
                {node.label}
              </text>

              {/* Sublabel */}
              {node.sublabel && (
                <text
                  x={node.x + 18} y={node.y + 34}
                  fill="rgba(180,170,160,0.4)" fontSize="8"
                  fontFamily="'JetBrains Mono', monospace"
                >
                  ({node.sublabel})
                </text>
              )}
            </g>
          );
        })}

        {/* ── "would replace" labels ── */}
        <text x={svgW - 60} y={160} fill="rgba(120,120,120,0.3)"
          fontSize="8" textAnchor="middle" fontStyle="italic">would replace</text>
        <text x={svgW - 60} y={380} fill="rgba(120,120,120,0.3)"
          fontSize="8" textAnchor="middle" fontStyle="italic">would replace</text>

        {/* Future HW box */}
        <rect x={svgW - 140} y={20} width={130} height={70} rx="4"
          fill="none" stroke="rgba(80,80,80,0.3)" strokeWidth="0.8" strokeDasharray="3 3" />
        <text x={svgW - 75} y={36} fill="rgba(120,120,120,0.35)"
          fontSize="7" textAnchor="middle" fontWeight="600">FUTURE HARDWARE</text>
        <text x={svgW - 75} y={48} fill="rgba(120,120,120,0.25)"
          fontSize="7" textAnchor="middle">Real camera /</text>
        <text x={svgW - 75} y={58} fill="rgba(120,120,120,0.25)"
          fontSize="7" textAnchor="middle">frame grabber</text>
        <text x={svgW - 75} y={76} fill="rgba(120,120,120,0.25)"
          fontSize="7" textAnchor="middle">Real servo / gimbal</text>
      </svg>

      {/* ── Live status summary ── */}
      <div className="pd-status-bar">
        {PIPELINE_NODES.map(node => {
          const status = getNodeStatus(node.id, store);
          return (
            <div key={node.id} className="pd-status-item" title={node.label}>
              <span className="pd-status-dot" style={{ background: STATUS_COLORS[status] }} />
              <span className="pd-status-label">{node.id.toUpperCase()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
