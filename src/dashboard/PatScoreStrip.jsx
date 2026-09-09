import React from 'react';
import { useSimStore } from '../store/simStore';

export default function PatScoreStrip() {
  const trial = useSimStore((s) => s.trial);
  const simTime = useSimStore((s) => s.simTime);
  const running = useSimStore((s) => s.simRunning);
  const paused = useSimStore((s) => s.simPaused);
  const card = useSimStore((s) => s.trialCard);
  const showCard = useSimStore((s) => s.showTrialCard);
  const exportTrialCard = useSimStore((s) => s.exportTrialCard);
  const dismissTrialCard = useSimStore((s) => s.dismissTrialCard);

  const tta = trial.firstLockTime == null ? '—' : trial.firstLockTime.toFixed(2);
  const duration = (running || paused ? simTime : (card?.duration ?? trial.duration)).toFixed(1);

  return (
    <>
      <div className="stats-row pat-score-strip">
        <div className="stat-cell">
          <div className="stat-label">Time to First Lock</div>
          <div className="stat-value">{tta} <span className="stat-unit">s</span></div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">RMS Error</div>
          <div className="stat-value">{(trial.rmsUrad || 0).toFixed(2)} <span className="stat-unit">µrad</span></div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Lock Retention</div>
          <div className="stat-value">{(trial.lockRetention || 0).toFixed(1)} <span className="stat-unit">%</span></div>
        </div>
        <div className="stat-cell highlight">
          <div className="stat-label">Trial Duration</div>
          <div className="stat-value">{duration} <span className="stat-unit">s</span></div>
        </div>
      </div>
      {showCard && card && (
        <div className="trial-card">
          <div>
            <div className="trial-card-title">Trial complete</div>
            <div className="trial-card-meta">
              TTA {card.firstLockTime == null ? 'N/A' : `${card.firstLockTime.toFixed(2)} s`}
              {' · '}RMS {card.rmsUrad.toFixed(2)} µrad
              {' · '}Hold {card.lockRetention.toFixed(1)}%
              {' · '}Decoys rejected {card.decoysRejected}
            </div>
          </div>
          <div className="trial-card-actions">
            <button className="sim-btn sim-btn-primary" onClick={exportTrialCard}>Download card</button>
            <button className="sim-btn" onClick={dismissTrialCard}>Dismiss</button>
          </div>
        </div>
      )}
    </>
  );
}
