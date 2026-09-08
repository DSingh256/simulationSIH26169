import React from 'react';
import { useSimStore } from '../store/simStore';
import LiveCameraFeed from './LiveCameraFeed';

function MiniCameraFeed({ uav, uavIndex, isSelected, isLive, targetUav }) {
  const signalDropoutActive = useSimStore(s => s.signalDropoutActive);
  
  const stateColor = (state) => {
    switch(state) {
      case 'LOCKED': return '#c87832';
      case 'TRACKING': return '#4ca854';
      case 'REACQUIRING': return '#8a7aaa';
      case 'ACQUIRING': return '#c89832';
      default: return '#c43a3a';
    }
  };

  return (
    <div className="camera-feed-card" style={isSelected ? { borderColor: 'var(--accent-blue)', boxShadow: '0 0 10px var(--border-glow)' } : {}}>
      <div className="feed-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div className={`status-dot ${stateColor(uav.trackingState)}`} style={{ background: stateColor(uav.trackingState), boxShadow: `0 0 4px ${stateColor(uav.trackingState)}` }}></div>
          {uav.id} Camera
        </div>
        <div>FOV: {uav.cameraFOV.toFixed(1)}°</div>
      </div>
      
      <div className="feed-viewport" style={{ flex: 1, position: 'relative' }}>
        {isLive ? (
          <LiveCameraFeed sourceUav={uav} targetUav={targetUav} uavIndex={uavIndex} />
        ) : (
          <div className="mock-feed" style={{ width: '100%', height: '100%', backgroundColor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#444', fontSize: '10px' }}>STANDBY</div>
          </div>
        )}

        {/* Reticle / Bounding Box Overlays */}
        {(uav.trackingState === 'LOCKED' || uav.trackingState === 'TRACKING') && (
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '24px', height: '24px',
            border: `1px solid ${stateColor(uav.trackingState)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none'
          }}>
            <div style={{ position: 'absolute', top: -10, color: stateColor(uav.trackingState), fontSize: '8px', fontWeight: 'bold' }}>{targetUav ? targetUav.id : ''}</div>
            <div style={{ position: 'absolute', bottom: -10, color: stateColor(uav.trackingState), fontSize: '8px' }}>{uav.trackingState}</div>
          </div>
        )}
      </div>

      <div className="feed-footer">
        <div>FPS: {uav.fps}</div>
        <div>Conf: {uav.confidence.toFixed(2)}</div>
        <div>Err: {uav.pointingError.toFixed(1)} px</div>
      </div>
    </div>
  );
}

export default function CameraFeedsRow() {
  const store = useSimStore();
  const uavs = store.uavs.slice(0, store.numUAVs);
  const [activeFeed, setActiveFeed] = React.useState(0);
  
  return (
    <div className="camera-feeds-row">
      <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', flexShrink: 0, letterSpacing: '0.6px' }}>
        Vision Feeds
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minHeight: 0 }}>
        {/* All Feeds (Horizontal Strip) */}
        <div style={{ display: 'flex', gap: '8px', height: '120px', flexShrink: 0 }}>
          {uavs.map((uav, i) => {
            const link = store.links.find(l => l.from === i);
            const targetUav = link ? store.uavs[link.to] : null;
            return (
              <div key={uav.id} onClick={() => setActiveFeed(i)} style={{ cursor: 'pointer', flex: 1, minWidth: 0, height: '100%' }}>
                <MiniCameraFeed 
                  uav={uav}
                  uavIndex={i}
                  isSelected={i === activeFeed} 
                  isLive={i === activeFeed} 
                  targetUav={targetUav}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
