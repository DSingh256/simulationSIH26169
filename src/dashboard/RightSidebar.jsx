import React from 'react';
import { useSimStore } from '../store/simStore';

export default function RightSidebar() {
  const uavs = useSimStore(s => s.uavs);
  const links = useSimStore(s => s.links);
  const numUAVs = useSimStore(s => s.numUAVs);

  const stateColor = (state) => {
    switch(state) {
      case 'LOCKED': return 'blue';
      case 'TRACKING': return 'green';
      case 'ACQUIRING': return 'amber';
      default: return 'red';
    }
  };

  const stateBadge = (state) => {
    const cls = state === 'LOCKED' ? 'locked' : state === 'TRACKING' ? 'tracking' : state === 'ACQUIRING' ? 'acquiring' : 'searching';
    return <span className={`status-badge ${cls}`}>{state}</span>;
  };

  // Build NxN link matrix
  const matrixSize = Math.min(numUAVs, 6);
  const linkMap = {};
  links.forEach(l => {
    linkMap[`${l.from}-${l.to}`] = l;
    linkMap[`${l.to}-${l.from}`] = l;
  });

  return (
    <div className="right-sidebar">
      {/* ─── FSOC Network ─── */}
      <div className="panel-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div className="panel-section-title" style={{ margin: 0 }}>FSOC Network</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '9px', color: 'var(--text-muted)' }}>
            Auto Link Management
            <div style={{ width: 28, height: 14, borderRadius: 7, background: 'var(--accent-blue)', position: 'relative', cursor: 'pointer' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, right: 2 }}></div>
            </div>
          </div>
        </div>

        <table className="sim-table">
          <thead>
            <tr>
              <th></th>
              <th>ID</th>
              <th>Status</th>
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
          {/* Header row */}
          <div className="link-matrix-cell header"></div>
          {Array.from({ length: matrixSize }, (_, i) => (
            <div key={`h${i}`} className="link-matrix-cell header">U{i + 1}</div>
          ))}

          {/* Data rows */}
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
