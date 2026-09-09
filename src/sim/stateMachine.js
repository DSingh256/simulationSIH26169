import { TrackingState, useSimStore } from '../store/simStore';

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
