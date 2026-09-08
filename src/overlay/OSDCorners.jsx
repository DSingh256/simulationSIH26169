import React, { useEffect, useState } from 'react';
import { useSimStore, TrackingState } from '../store/simStore';

export default function OSDCorners() {
  const trackingState = useSimStore(state => state.trackingState);
  const fov = useSimStore(state => state.fov);
  const pointingError = useSimStore(state => state.pointingError);
  
  const [time, setTime] = useState('');
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setTime(d.toISOString().replace('T', ' ').substring(0, 23) + 'Z');
      setFrame(f => (f + 1) % 99999);
    }, 100); // 10fps update for OSD text
    return () => clearInterval(timer);
  }, []);

  const color = trackingState === TrackingState.SEARCHING ? '#ff3333' : 
                trackingState === TrackingState.TRACKING ? '#00e676' : 
                trackingState === TrackingState.LOCKED ? '#ffffff' : '#ffb300';

  const baseStyle = {
    position: 'absolute',
    color: '#00e676',
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '14px',
    fontWeight: 'bold',
    textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
    pointerEvents: 'none'
  };

  return (
    <>
      {/* Top Left - Timestamp & Frame */}
      <div style={{ ...baseStyle, top: 20, left: 20 }}>
        <div>{time}</div>
        <div>FRM {frame.toString().padStart(5, '0')}</div>
      </div>

      {/* Top Right - Optics */}
      <div style={{ ...baseStyle, top: 20, right: 20, textAlign: 'right' }}>
        <div>FOV {fov.toFixed(2)}°</div>
      </div>

      {/* Bottom Left - Tracking State */}
      <div style={{ ...baseStyle, bottom: 20, left: 20, color: color, fontSize: '16px' }}>
        <div>{trackingState}</div>
      </div>

      {/* Bottom Right - Pointing Error */}
      <div style={{ ...baseStyle, bottom: 20, right: 20, textAlign: 'right' }}>
        <div>dX {(pointingError.x * 1000).toFixed(2)} mrad</div>
        <div>dY {(pointingError.y * 1000).toFixed(2)} mrad</div>
      </div>
    </>
  );
}
