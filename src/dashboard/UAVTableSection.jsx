import React from 'react';
import { useSimStore } from '../store/simStore';

export default function UAVTableSection() {
  const uavs = useSimStore(s => s.uavs);
  const links = useSimStore(s => s.links);
  const numUAVs = useSimStore(s => s.numUAVs);

  const stateColor = (state) => {
    switch(state) {
      case 'LOCKED': return 'orange';
      case 'TRACKING': return 'green';
      case 'REACQUIRING': return 'amber';
      case 'ACQUIRING': return 'amber';
      default: return 'red';
    }
  };

  const stateBadge = (state) => {
    const cls = state === 'LOCKED' ? 'locked' : state === 'TRACKING' ? 'tracking' : state === 'REACQUIRING' ? 'reacquiring' : state === 'ACQUIRING' ? 'acquiring' : 'searching';
    return <span className={`status-badge ${cls}`}>{state}</span>;
  };

  const getUAVLink = (idx) => {
    return links.find(l => l.from === idx) || {};
  };

  return (
    <div className="uav-table-section">
      <div className="uav-table-header">
        <div className="uav-table-title">{numUAVs}-Node Optical Interconnect</div>
        <div className="uav-table-filters">
          <button className="active">All Nodes</button>
          <button>Locked</button>
          <button>Acquiring</button>
          <button>Search</button>
        </div>
      </div>

      <table className="full-table">
        <thead>
          <tr>
            <th>Node</th>
            <th>Status</th>
            <th>Position</th>
            <th>Speed</th>
            <th>Altitude</th>
            <th>Confidence</th>
            <th>Pointing Error</th>
            <th>Battery</th>
            <th>Link Mode</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody>
          {uavs.slice(0, numUAVs).map((uav, i) => {
            const link = getUAVLink(i);
            return (
              <tr key={uav.id}>
                <td>
                  <div className="uav-name">
                    <span className={`status-dot ${stateColor(uav.trackingState)}`}></span>
                    {uav.id}
                  </div>
                </td>
                <td>{stateBadge(uav.trackingState)}</td>
                <td>{uav.position[0].toFixed(0)}, {uav.position[2].toFixed(0)}</td>
                <td>{uav.speed} m/s</td>
                <td>{uav.altitude} m</td>
                <td style={{ color: uav.confidence > 0.9 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                  {(uav.confidence * 100).toFixed(1)}%
                </td>
                <td>{uav.pointingError.toFixed(2)} px</td>
                <td>{uav.battery}%</td>
                <td>{uav.linkMode}</td>
                <td>{stateBadge(uav.trackingState)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
