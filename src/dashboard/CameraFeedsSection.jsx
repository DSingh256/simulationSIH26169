import React from 'react';
import { useSimStore } from '../store/simStore';
import LiveCameraFeed from './LiveCameraFeed';

const FEED_INFO = [
  { title: 'Wide Field Track', desc: 'Primary acquisition camera with broad field of view for initial target detection.' },
  { title: 'Sub-Pixel Reticle', desc: 'Fine tracking camera for sub-pixel centroid extraction and pointing refinement.' },
  { title: 'Thermal Infrared', desc: 'IR band imaging for target discrimination against background clutter.' },
];

function FeedCard({ uav, uavIndex, targetUav, info, link }) {
  const stateColor = (state) => {
    switch(state) {
      case 'LOCKED': return '#c87832';
      case 'TRACKING': return '#4ca854';
      case 'REACQUIRING': return '#8a7aaa';
      case 'ACQUIRING': return '#c89832';
      default: return '#c43a3a';
    }
  };

  const stateBadge = (state) => {
    const cls = state === 'LOCKED' ? 'locked' : state === 'TRACKING' ? 'tracking' : state === 'REACQUIRING' ? 'reacquiring' : state === 'ACQUIRING' ? 'acquiring' : 'searching';
    return <span className={`status-badge ${cls}`}>{state}</span>;
  };

  return (
    <div className="feed-card">
      <div className="feed-viewport">
        {targetUav ? (
          <LiveCameraFeed sourceUav={uav} targetUav={targetUav} uavIndex={uavIndex} link={link} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: 10 }}>STANDBY</div>
        )}
        <div className="feed-overlay">
          <span>{uav.id}</span>
          <span>FOV {uav.cameraFOV.toFixed(1)}°</span>
        </div>
      </div>
      <div className="feed-body">
        <div className="feed-card-title">
          <span>{info.title}</span>
          {stateBadge(uav.trackingState)}
        </div>
        <div className="feed-card-desc">{info.desc}</div>
      </div>
      <div className="feed-card-footer">
        <span>FPS {uav.fps}</span>
        <span>CONF {uav.confidence.toFixed(2)}</span>
        <span>ERR {uav.pointingError.toFixed(1)} px</span>
      </div>
    </div>
  );
}

export default function CameraFeedsSection() {
  const store = useSimStore();
  const uavs = store.uavs.slice(0, Math.min(store.numUAVs, 3));

  return (
    <div className="feeds-section">
      <div className="feeds-section-header">
        <div>
          <div className="feeds-section-title">Synchronized Vision Feeds</div>
          <div className="feeds-section-desc">Multi-spectral acquisition, sub-pixel tracking, and thermal infrared channels.</div>
        </div>
      </div>
      <div className="feeds-grid">
        {uavs.map((uav, i) => {
          const link = store.links.find(l => l.from === i) || store.links.find(l => l.to === i);
          const peerIdx = link ? (link.from === i ? link.to : link.from) : -1;
          const targetUav = peerIdx >= 0 ? store.uavs[peerIdx] : null;
          return (
            <FeedCard
              key={uav.id}
              uav={uav}
              uavIndex={i}
              targetUav={targetUav}
              link={link}
              info={FEED_INFO[i] || FEED_INFO[0]}
            />
          );
        })}
      </div>
    </div>
  );
}
