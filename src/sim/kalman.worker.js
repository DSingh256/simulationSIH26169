// 4D Kalman Filter for Constant Velocity Model
// State vector: [x, y, vx, vy]
// Measurement vector: [x, y]

export class KalmanFilterCV {
  constructor(dt) {
    this.dt = dt;
    
    // State [x, y, vx, vy]
    this.x = [0, 0, 0, 0];
    
    // Covariance matrix
    this.P = [
      [1000, 0, 0, 0],
      [0, 1000, 0, 0],
      [0, 0, 1000, 0],
      [0, 0, 0, 1000]
    ];
    
    // State transition matrix
    this.A = [
      [1, 0, dt, 0],
      [0, 1, 0, dt],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];
    
    // Measurement matrix
    this.H = [
      [1, 0, 0, 0],
      [0, 1, 0, 0]
    ];
    
    // Measurement noise covariance
    this.R = [
      [10, 0],
      [0, 10]
    ];
    
    // Process noise covariance
    const q = 0.1;
    this.Q = [
      [q, 0, 0, 0],
      [0, q, 0, 0],
      [0, 0, q, 0],
      [0, 0, 0, q]
    ];
    
    this.initialized = false;
    this.framesSinceLastDetection = 0;
  }

  // Simple matrix multiplication for our specific sizes
  multiplyVector(mat, vec) {
    const res = new Array(mat.length).fill(0);
    for (let i = 0; i < mat.length; i++) {
      for (let j = 0; j < vec.length; j++) {
        res[i] += mat[i][j] * vec[j];
      }
    }
    return res;
  }

  predict() {
    if (!this.initialized) return;
    // x = A * x
    this.x = this.multiplyVector(this.A, this.x);
    // P = A * P * A^T + Q  (simplified approximation here since we don't have a math lib, keeping it diagonal-ish)
    for(let i=0; i<4; i++) {
        this.P[i][i] = this.P[i][i] + this.Q[i][i]; 
    }
    this.framesSinceLastDetection++;
  }

  update(z_x, z_y) {
    if (!this.initialized) {
      this.x = [z_x, z_y, 0, 0];
      this.initialized = true;
      this.framesSinceLastDetection = 0;
      return;
    }
    
    this.framesSinceLastDetection = 0;
    
    // y = z - H * x
    const y_x = z_x - this.x[0];
    const y_y = z_y - this.x[1];
    
    // S = H * P * H^T + R -> simplified for diagonal
    const S_x = this.P[0][0] + this.R[0][0];
    const S_y = this.P[1][1] + this.R[1][1];
    
    // K = P * H^T * S^-1
    const K_00 = this.P[0][0] / S_x;
    const K_11 = this.P[1][1] / S_y;
    const K_20 = this.P[2][2] / S_x; // cross terms simplified
    const K_31 = this.P[3][3] / S_y;
    
    // x = x + K * y
    this.x[0] += K_00 * y_x;
    this.x[1] += K_11 * y_y;
    this.x[2] += K_20 * y_x;
    this.x[3] += K_31 * y_y;
    
    // P = (I - K * H) * P
    this.P[0][0] *= (1 - K_00);
    this.P[1][1] *= (1 - K_11);
    // ... approximation
  }
}

const kf = new KalmanFilterCV(1/60);

self.onmessage = (e) => {
  const { type, data } = e.data;
  
  if (type === 'PROCESS_DETECTION') {
    const { candidates } = data; // from new detector logic
    
    // Find best candidate (highest confidence from classical + CNN if available)
    let best = null;
    if (candidates && candidates.length > 0) {
      best = candidates.reduce((prev, current) => (prev.confidence > current.confidence) ? prev : current);
    }
    
    kf.predict();
    
    if (best && best.confidence > 0.5) {
      kf.update(best.box.x, best.box.y);
      
      self.postMessage({
        type: 'FILTERED_POSITION',
        data: { 
          x: kf.x[0], 
          y: kf.x[1], 
          width: best.box.width, 
          height: best.box.height, 
          confidence: best.confidence,
          framesSinceLastLock: kf.framesSinceLastDetection
        }
      });
    } else {
      // Coasting
      self.postMessage({
        type: 'FILTERED_POSITION',
        data: {
            x: kf.x[0],
            y: kf.x[1],
            width: 40, height: 40,
            confidence: 0, // decayed
            framesSinceLastLock: kf.framesSinceLastDetection
        }
      });
    }
  }
};
