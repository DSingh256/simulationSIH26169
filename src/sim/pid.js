// PID Controller
export class PIDController {
  constructor(kp, ki, kd) {
    this.kp = kp;
    this.ki = ki;
    this.kd = kd;
    
    this.integral = 0;
    this.previousError = 0;
  }

  update(error, dt) {
    if (dt <= 0) return 0;
    
    this.integral += error * dt;
    
    // anti-windup
    if (this.integral > 10) this.integral = 10;
    if (this.integral < -10) this.integral = -10;
    
    const derivative = (error - this.previousError) / dt;
    
    const output = (this.kp * error) + (this.ki * this.integral) + (this.kd * derivative);
    
    this.previousError = error;
    
    return output;
  }

  reset() {
    this.integral = 0;
    this.previousError = 0;
  }
}
