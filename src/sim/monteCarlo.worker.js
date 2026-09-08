// Headless Monte Carlo Simulation Worker
// Approximates the physical pipeline to generate statistically valid charts without rendering WebGL

function runTrial(withCNN, turbulence) {
  let state = 'SEARCHING';
  let frames = 0;
  let targetPos = 0; // 1D simplification for speed
  let kfPos = NaN;
  let kfCov = 1000;
  let timeToLock = -1;
  let errors = [];

  for (let t = 0; t < 600; t++) { // 10 seconds at 60fps
    frames++;
    targetPos += Math.sin(t * 0.05) * 5; // drifting target

    // Predict
    if (!isNaN(kfPos)) {
      kfPos += 0; // assume constant pos for this simplified 1D version
      kfCov += 0.1;
    }

    // Detection (simulate classical + CNN)
    let detectionFound = false;
    let detectionZ = 0;
    
    // Base probability of detecting true target based on turbulence
    const detectProb = Math.max(0.1, 0.9 - (turbulence * 0.3));
    
    // False positive probability (glints)
    const falsePosProb = 0.3; // high false pos rate in classical

    if (Math.random() < detectProb) {
      detectionFound = true;
      detectionZ = targetPos + (Math.random() - 0.5) * turbulence * 20; // add noise
    } else if (Math.random() < falsePosProb) {
      // Picked up a glint
      if (!withCNN || Math.random() < 0.1) { // CNN rejects 90% of glints
        detectionFound = true;
        detectionZ = targetPos + 200 + (Math.random() - 0.5) * 50; // far away
      }
    }

    if (detectionFound) {
      if (isNaN(kfPos)) {
        kfPos = detectionZ;
        kfCov = 10;
      } else {
        const K = kfCov / (kfCov + 10);
        kfPos = kfPos + K * (detectionZ - kfPos);
        kfCov = (1 - K) * kfCov;
      }
      
      if (state === 'SEARCHING') {
        state = 'TRACKING';
        if (timeToLock < 0 && Math.abs(kfPos - targetPos) < 50) { // actually tracking the target, not a glint
          timeToLock = frames / 60.0;
        }
      }
    } else {
      if (state === 'TRACKING' && kfCov > 50) {
        state = 'REACQUIRING';
      } else if (state === 'REACQUIRING' && kfCov > 100) {
        state = 'SEARCHING';
        kfPos = NaN;
      }
    }

    if (state === 'TRACKING') {
      errors.push(Math.abs(kfPos - targetPos));
    }
  }

  const rmse = errors.length > 0 ? Math.sqrt(errors.reduce((a, b) => a + b*b, 0) / errors.length) : -1;
  const locked = timeToLock > 0;

  return { locked, timeToLock, rmse };
}

self.onmessage = (e) => {
  const { trials = 100, turbulence = 0.5 } = e.data;
  
  const baselineResults = [];
  const aiResults = [];
  
  for(let i=0; i<trials; i++) {
    baselineResults.push(runTrial(false, turbulence));
    aiResults.push(runTrial(true, turbulence));
  }
  
  // Aggregate
  const baselineLockRate = baselineResults.filter(r => r.locked).length / trials;
  const aiLockRate = aiResults.filter(r => r.locked).length / trials;
  
  const aiRmse = aiResults.filter(r => r.locked).reduce((sum, r) => sum + r.rmse, 0) / Math.max(1, aiResults.filter(r => r.locked).length);
  const aiAcqTime = aiResults.filter(r => r.locked).reduce((sum, r) => sum + r.timeToLock, 0) / Math.max(1, aiResults.filter(r => r.locked).length);
  
  // Create probability curve data (CDF of lock time)
  const lockCurve = [];
  for(let sec = 1; sec <= 10; sec++) {
    const baseLockedByT = baselineResults.filter(r => r.locked && r.timeToLock <= sec).length / trials;
    const aiLockedByT = aiResults.filter(r => r.locked && r.timeToLock <= sec).length / trials;
    lockCurve.push({
      time: sec,
      baseline: baseLockedByT * 100,
      aiAssisted: aiLockedByT * 100
    });
  }

  self.postMessage({
    type: 'MONTE_CARLO_RESULTS',
    data: {
      baselineLockRate,
      aiLockRate,
      aiRmse,
      aiAcqTime,
      lockCurve
    }
  });
};
