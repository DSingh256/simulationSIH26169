import asyncio
import numpy as np
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocketDisconnect

app = FastAPI(title="ISRO SIH26169 Camera Tracking Simulation")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class KalmanFilter2D:
    def __init__(self, dt):
        self.dt = dt
        self.x = np.zeros((4, 1)) # [x, y, vx, vy]
        
        self.F = np.array([[1, 0, dt, 0],
                           [0, 1, 0, dt],
                           [0, 0, 1, 0],
                           [0, 0, 0, 1]])
        
        self.H = np.array([[1, 0, 0, 0],
                           [0, 1, 0, 0]])
        
        q = 0.05
        self.Q = np.array([[q, 0, 0, 0],
                           [0, q, 0, 0],
                           [0, 0, q, 0],
                           [0, 0, 0, q]])
        
        r = 10.0
        self.R = np.array([[r, 0],
                           [0, r]])
        
        self.P = np.eye(4)

    def predict(self):
        self.x = np.dot(self.F, self.x)
        self.P = np.dot(np.dot(self.F, self.P), self.F.T) + self.Q
        return self.x[0:2]

    def update(self, z):
        y = z - np.dot(self.H, self.x)
        S = np.dot(np.dot(self.H, self.P), self.H.T) + self.R
        K = np.dot(np.dot(self.P, self.H.T), np.linalg.inv(S))
        self.x = self.x + np.dot(K, y)
        self.P = self.P - np.dot(np.dot(K, self.H), self.P)

class Target:
    def __init__(self, start_x, start_y):
        self.x = start_x
        self.y = start_y
        self.size = 10
        self.mode = 'circular'
        self.time = 0.0
        self.start_x = start_x
        self.start_y = start_y

    def update(self, dt):
        self.time += dt
        if self.mode == 'straight':
            self.x += 50 * dt
            self.y += 20 * dt
        elif self.mode == 'circular':
            radius = 300
            self.x = self.start_x + radius * np.cos(0.5 * self.time)
            self.y = self.start_y + radius * np.sin(0.5 * self.time)
        elif self.mode == 'figure8':
            radius_x = 300
            radius_y = 150
            self.x = self.start_x + radius_x * np.sin(0.5 * self.time)
            self.y = self.start_y + radius_y * np.sin(0.5 * self.time) * np.cos(0.5 * self.time)
        elif self.mode == 'random':
            self.x += np.random.normal(0, 50 * dt)
            self.y += np.random.normal(0, 50 * dt)
        
        self.x = np.clip(self.x, 0, 2000)
        self.y = np.clip(self.y, 0, 2000)

class CameraViewport:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.width = 640
        self.height = 480
        self.fov_deg_per_pixel = 0.00625

    def get_relative(self, target_x, target_y):
        rel_x = target_x - (self.x - self.width / 2)
        rel_y = target_y - (self.y - self.height / 2)
        return rel_x, rel_y

class NoiseEngine:
    @staticmethod
    def platform_jitter(intensity=1.0):
        return np.random.uniform(-20 * intensity, 20 * intensity), np.random.uniform(-20 * intensity, 20 * intensity)

    @staticmethod
    def sensor_noise(x, y, condition):
        # Simulate different atmospheric and noise conditions
        if condition == 'cloud':
            if np.random.random() < 0.3: # 30% chance of target occlusion
                return None, None
            return x + np.random.normal(0, 15), y + np.random.normal(0, 15)
        elif condition == 'rain':
            if np.random.random() < 0.1: # 10% chance of dropout
                return None, None
            return x + np.random.normal(0, 8), y + np.random.normal(0, 8)
        else:
            return x + np.random.normal(0, 2), y + np.random.normal(0, 2)

def CentroidTracker(bbox_x, bbox_y, w, h):
    return bbox_x + w / 2, bbox_y + h / 2

class PIDController:
    def __init__(self, Kp, Ki, Kd, max_out=10.0):
        self.Kp = Kp
        self.Ki = Ki
        self.Kd = Kd
        self.max_out = max_out
        self.integral_x = 0
        self.integral_y = 0
        self.prev_error_x = 0
        self.prev_error_y = 0

    def calculate(self, error_x, error_y, dt):
        self.integral_x += error_x * dt
        self.integral_y += error_y * dt
        
        deriv_x = (error_x - self.prev_error_x) / dt
        deriv_y = (error_y - self.prev_error_y) / dt
        
        out_x = self.Kp * error_x + self.Ki * self.integral_x + self.Kd * deriv_x
        out_y = self.Kp * error_y + self.Ki * self.integral_y + self.Kd * deriv_y
        
        self.prev_error_x = error_x
        self.prev_error_y = error_y
        
        out_x = np.clip(out_x, -self.max_out, self.max_out)
        out_y = np.clip(out_y, -self.max_out, self.max_out)
        
        return out_x, out_y

@app.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    target = Target(1000, 1000)
    camera = CameraViewport(1000, 1000)
    pid = PIDController(0.01, 0.001, 0.005) # 10 deg/s max
    kf = KalmanFilter2D(1/30.0)
    
    dt = 1.0 / 30.0
    
    rel_x, rel_y = camera.get_relative(target.x, target.y)
    kf.x[0, 0] = rel_x
    kf.x[1, 0] = rel_y
    
    sim_time = 0
    
    try:
        while True:
            target.update(dt)
            sim_time += dt
            
            # Cycle weather every 10 seconds (clear -> rain -> cloud -> repeat)
            weather_cycle = int(sim_time / 10) % 3
            weather = ['clear', 'rain', 'cloud'][weather_cycle]
            
            rel_x, rel_y = camera.get_relative(target.x, target.y)
            
            # Air jitter is higher in rain/cloud
            intensity = 1.5 if weather != 'clear' else 1.0
            jx, jy = NoiseEngine.platform_jitter(intensity)
            
            noisy_res = NoiseEngine.sensor_noise(rel_x + jx, rel_y + jy, weather)
            
            kf.predict()
            
            if noisy_res[0] is not None:
                noisy_x, noisy_y = noisy_res
                bbox_x = noisy_x - 5
                bbox_y = noisy_y - 5
                centroid_x, centroid_y = CentroidTracker(bbox_x, bbox_y, 10, 10)
                z = np.array([[centroid_x], [centroid_y]])
                kf.update(z)
                target_visible = True
            else:
                # Occlusion / dropout! Use predicted location for PID
                noisy_x, noisy_y = -999, -999
                centroid_x, centroid_y = float(kf.x[0,0]), float(kf.x[1,0])
                target_visible = False
            
            pred_x, pred_y = float(kf.x[0,0]), float(kf.x[1,0])
            
            err_x = centroid_x - 320
            err_y = centroid_y - 240
            
            pan_vel, tilt_vel = pid.calculate(err_x, err_y, dt)
            
            cam_shift_x = pan_vel * (1 / camera.fov_deg_per_pixel) * dt
            cam_shift_y = tilt_vel * (1 / camera.fov_deg_per_pixel) * dt
            
            camera.x += cam_shift_x
            camera.y += cam_shift_y
            
            data = {
                "weather": weather,
                "target_visible": target_visible,
                "target_global": {"x": float(target.x), "y": float(target.y)},
                "camera_global": {"x": float(camera.x), "y": float(camera.y)},
                "true_relative": {"x": float(rel_x), "y": float(rel_y)},
                "noisy_relative": {"x": float(noisy_x), "y": float(noisy_y)},
                "kalman_pred": {"x": pred_x, "y": pred_y},
                "error": {"x": float(err_x), "y": float(err_y)},
                "pan_vel": float(pan_vel),
                "tilt_vel": float(tilt_vel)
            }
            
            await websocket.send_json(data)
            await asyncio.sleep(dt)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Error: {e}")
