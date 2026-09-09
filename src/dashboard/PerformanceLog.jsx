import React, { useState } from 'react';
import { useSimStore } from '../store/simStore';
import { usePerfLogStore } from '../store/perfLogStore';

export default function PerformanceLog() {
  const simStore = useSimStore();
  const perfStore = usePerfLogStore();
  const { runs, clearRuns, exportCSV } = perfStore;

  if (!simStore.performanceLogOpen) return null;

  const handleDownload = () => {
    const csvContent = exportCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `virtupat-p4-log-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p4-perf-modal-overlay">
      <div className="p4-perf-modal">
        <div className="p4-perf-header">
          <h2>Performance Log (Part 4)</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="sim-btn" onClick={handleDownload} disabled={runs.length === 0}>
              ⬇ Download CSV
            </button>
            <button className="sim-btn sim-btn-danger" onClick={clearRuns} disabled={runs.length === 0}>
              Clear
            </button>
            <button className="sim-btn" onClick={() => simStore.setPerformanceLogOpen(false)}>
              ✕ Close
            </button>
          </div>
        </div>

        <div className="p4-perf-table-container">
          {runs.length === 0 ? (
            <div className="p4-perf-empty">No runs recorded yet. Start and finish a Part 4 run to generate logs.</div>
          ) : (
            <table className="p4-perf-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Timestamp</th>
                  <th>Scenario</th>
                  <th>Detector</th>
                  <th>Search</th>
                  <th>Seed</th>
                  <th>Dwell Time (s)</th>
                  <th>Link Acq (s)</th>
                  <th>Link Maint (s)</th>
                  <th>Reacqs</th>
                  <th>Turbulence</th>
                  <th>Occlusion</th>
                  <th>Glint</th>
                  <th>Dropout</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r, i) => (
                  <tr key={r.id}>
                    <td>#{i + 1}</td>
                    <td>{new Date(r.timestamp).toLocaleTimeString()}</td>
                    <td>{r.scenario}</td>
                    <td>{r.detectorMode}</td>
                    <td>{r.searchPattern}</td>
                    <td>{r.seed}</td>
                    <td>{r.dwellTime.toFixed(1)}</td>
                    <td>{r.linkAcquisitionTime ? r.linkAcquisitionTime.toFixed(2) : 'FAIL'}</td>
                    <td>{r.linkMaintainedTime.toFixed(1)}</td>
                    <td>{r.reacquireCount}</td>
                    <td>{r.disturbances.turbulence.toFixed(2)}</td>
                    <td>{r.disturbances.occlusion.toFixed(2)}</td>
                    <td>{r.disturbances.glint.toFixed(2)}</td>
                    <td>{r.disturbances.dropout.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
