import React from 'react';
import { useSimStore, TrackingState } from '../store/simStore';

export default function BoundingBoxOverlay() {
  const detectionBox = useSimStore(state => state.detectionBox);
  const confidence = useSimStore(state => state.detectionConfidence);
  const trackingState = useSimStore(state => state.trackingState);
  
  if (!detectionBox || trackingState === TrackingState.SEARCHING) return null;

  const { x, y, width, height } = detectionBox;
  
  // Color based on confidence/state
  const color = trackingState === TrackingState.TRACKING ? '#00e676' : 
                trackingState === TrackingState.LOCKED ? '#ffffff' : '#ffb300';
  
  return (
    <div style={{
      position: 'absolute',
      top: y - height / 2,
      left: x - width / 2,
      width: width,
      height: height,
      border: `2px solid ${color}`,
      pointerEvents: 'none',
      transition: 'all 0.1s linear' // smooth the worker updates
    }}>
      {/* Corner accents */}
      <div style={{ position: 'absolute', top: -5, left: -5, width: 10, height: 10, borderTop: `2px solid ${color}`, borderLeft: `2px solid ${color}` }} />
      <div style={{ position: 'absolute', top: -5, right: -5, width: 10, height: 10, borderTop: `2px solid ${color}`, borderRight: `2px solid ${color}` }} />
      <div style={{ position: 'absolute', bottom: -5, left: -5, width: 10, height: 10, borderBottom: `2px solid ${color}`, borderLeft: `2px solid ${color}` }} />
      <div style={{ position: 'absolute', bottom: -5, right: -5, width: 10, height: 10, borderBottom: `2px solid ${color}`, borderRight: `2px solid ${color}` }} />

      {/* Confidence Label */}
      <div style={{
        position: 'absolute',
        top: '-20px',
        right: '-10px',
        color: color,
        fontSize: '12px',
        fontFamily: 'monospace',
        textShadow: '0 0 2px #000'
      }}>
        CONF: {(confidence * 100).toFixed(0)}%
      </div>
    </div>
  );
}
