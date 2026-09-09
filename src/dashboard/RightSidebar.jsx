import React from 'react';
import { useSimStore } from '../store/simStore';

export default function RightSidebar() {
  const uavs = useSimStore(s => s.uavs);
  const links = useSimStore(s => s.links);
  const numUAVs = useSimStore(s => s.numUAVs);

  const stateColor = (state) => {
    switch(state) {
      case 'LOCKED': return 'orange';
      case 'TRACKING': return 'green';
      case 'REACQUIRING': return 'blue';
      case 'ACQUIRING': return 'amber';
      default: return 'red';
    }
  };

  const stateBadge = (state) => {
    const cls = state === 'LOCKED' ? 'locked' : state === 'TRACKING' ? 'tracking' : state === 'REACQUIRING' ? 'reacquiring' : state === 'ACQUIRING' ? 'acquiring' : 'searching';
    return <span className={`status-badge ${cls}`}>{state}</span>;
  };

  const matrixSize = Math.min(numUAVs, 6);
  const linkMap = {};
  links.forEach(l => {
    linkMap[`${l.from}-${l.to}`] = l;
    linkMap[`${l.to}-${l.from}`] = l;
  });

  return (
    <div className="right-sidebar">
      {/* ─── Node Table ─── */}
      <div className="panel-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div className="panel-section-title" style={{ margin: 0 }}>Nodes</div>
        </div>

        <table className="sim-table">
          <thead>
            <tr>
              <th></th>
              <th>ID</th>
              <th>State</th>
              <th>Links</th>
              <th>Bat</th>
              <th>Mode</th>
            </tr>
          </thead>
          <tbody>
            {uavs.slice(0, numUAVs).map((uav, i) => (
              <tr key={uav.id}>
                <td><span className={`status-dot ${stateColor(uav.trackingState)}`}></span></td>
                <td>{uav.id}</td>
                <td>{stateBadge(uav.trackingState)}</td>
                <td>{uav.links}</td>
                <td>{uav.battery}%</td>
                <td>{uav.linkMode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Link Matrix ─── */}
      <div className="panel-section">
        <div className="panel-section-title">Link Matrix</div>
        <div 
          className="link-matrix" 
          style={{ gridTemplateColumns: `repeat(${matrixSize + 1}, 1fr)` }}
        >
          <div className="link-matrix-cell header"></div>
          {Array.from({ length: matrixSize }, (_, i) => (
            <div key={`h${i}`} className="link-matrix-cell header">U{i + 1}</div>
          ))}

          {Array.from({ length: matrixSize }, (_, row) => (
            <React.Fragment key={`r${row}`}>
              <div className="link-matrix-cell header">U{row + 1}</div>
              {Array.from({ length: matrixSize }, (_, col) => {
                if (row === col) return <div key={`c${col}`} className="link-matrix-cell self">—</div>;
                const link = linkMap[`${row}-${col}`];
                return (
                  <div 
                    key={`c${col}`} 
                    className={`link-matrix-cell ${link ? 'active' : ''}`}
                    style={link ? { cursor: 'pointer' } : {}}
                    onClick={() => {
                      if (!link) return;
                      const idx = links.findIndex(l => (l.from === row && l.to === col) || (l.from === col && l.to === row));
                      if (idx >= 0) useSimStore.getState().setSelectedLink(idx);
                    }}
                  >
                    {link ? '●' : ''}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
