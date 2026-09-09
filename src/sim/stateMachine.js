import { TrackingState, TerminalPhase } from '../store/simStore';

/**
 * Legacy state machine — preserved for Part 1-3 compatibility.
 */
export function updateStateMachine(currentState, confidence, framesSinceLastLock) {
  let nextState = currentState;

  switch (currentState) {
    case TrackingState.SEARCHING:
      if (confidence > 0.8) {
        nextState = TrackingState.TRACKING; // COARSE_TRACK
      }
      break;
    
    case TrackingState.TRACKING:
      if (confidence < 0.3) {
        if (framesSinceLastLock > 10) {
          nextState = TrackingState.REACQUIRING;
        }
      } else {
        // We have a solid lock, stay here
      }
      break;
    
    case TrackingState.REACQUIRING:
      if (confidence > 0.7) {
        nextState = TrackingState.TRACKING;
      } else if (framesSinceLastLock > 60) {
        // Coasting for too long, back to search
        nextState = TrackingState.SEARCHING;
      }
      break;
      
    default:
      nextState = TrackingState.SEARCHING;
  }

  return nextState;
}

/**
 * Part 4 Terminal Phase Machine
 * Maps terminal phases to display states for UI badges.
 */
export function getPhaseDisplayInfo(phase) {
  switch (phase) {
    case TerminalPhase.DEPLOYED:
      return { label: 'DEPLOYED', color: '#7E8B93', pulse: false };
    case TerminalPhase.SEARCHING:
      return { label: 'SEARCHING', color: '#c89832', pulse: true };
    case TerminalPhase.LINK_ESTABLISHING:
      return { label: 'LINK ESTABLISHING', color: '#e8a832', pulse: true };
    case TerminalPhase.COARSE_TRACK:
      return { label: 'COARSE_TRACK', color: '#00e676', pulse: false };
    case TerminalPhase.REACQUIRE:
      return { label: 'REACQUIRE', color: '#8a7aaa', pulse: true };
    default:
      return { label: phase || 'UNKNOWN', color: '#c43a3a', pulse: false };
  }
}
