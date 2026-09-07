import React, { useEffect, useRef, useState } from 'react';

function App() {
  const radarCanvasRef = useRef(null);
  const cameraCanvasRef = useRef(null);
  
  const [telemetry, setTelemetry] = useState(null);
  const [logs, setLogs] = useState([]);
  const [fps, setFps] = useState(0);
  
  const framesRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/telemetry');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setTelemetry(data);
      setLogs(prev => {
          const newLogs = [...prev, { ...data, timestamp: new Date().toISOString() }];
          if (newLogs.length > 300) newLogs.shift();
          return newLogs;
      });
      
      framesRef.current++;
      const now = performance.now();
      if (now - lastTimeRef.current >= 1000) {
          setFps(framesRef.current);
          framesRef.current = 0;
          lastTimeRef.current = now;
      }
    };
    
    return () => ws.close();
  }, []);

  useEffect(() => {
    if (!telemetry) return;

    // Draw Radar
    const radarCtx = radarCanvasRef.current.getContext('2d');
    radarCtx.clearRect(0, 0, 200, 200);
    
    // Scale 2000 to 200 (divide by 10)
    radarCtx.fillStyle = 'red';
    radarCtx.beginPath();
    radarCtx.arc(telemetry.target_global.x / 10, telemetry.target_global.y / 10, 3, 0, 2 * Math.PI);
    radarCtx.fill();
    
    radarCtx.fillStyle = 'blue';
    radarCtx.fillRect(telemetry.camera_global.x / 10 - 3, telemetry.camera_global.y / 10 - 3, 6, 6);

    // Draw Camera Feed
    const camCtx = cameraCanvasRef.current.getContext('2d');
    camCtx.fillStyle = 'black';
    camCtx.fillRect(0, 0, 640, 480);
    
    // Draw crosshair
    camCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    camCtx.beginPath();
    camCtx.moveTo(320, 0);
    camCtx.lineTo(320, 480);
    camCtx.moveTo(0, 240);
    camCtx.lineTo(640, 240);
    camCtx.stroke();
    
    // Draw Weather Overlay
    if (telemetry.weather === 'cloud') {
        camCtx.fillStyle = 'rgba(200, 200, 200, 0.5)';
        camCtx.fillRect(0, 0, 640, 480);
        camCtx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        for (let i = 0; i < 6; i++) {
            camCtx.beginPath();
            camCtx.arc(100 * i, 100 + (Math.sin(framesRef.current * 0.1 + i) * 50), 60 + i * 10, 0, 2 * Math.PI);
            camCtx.fill();
        }
    } else if (telemetry.weather === 'rain') {
        camCtx.fillStyle = 'rgba(100, 100, 150, 0.3)';
        camCtx.fillRect(0, 0, 640, 480);
        camCtx.strokeStyle = 'rgba(200, 200, 255, 0.8)';
        camCtx.lineWidth = 1;
        camCtx.beginPath();
        for(let i=0; i<30; i++) {
            const rx = Math.random() * 640;
            const ry = Math.random() * 480;
            camCtx.moveTo(rx, ry);
            camCtx.lineTo(rx - 10, ry + 20);
        }
        camCtx.stroke();
    }
    
    // Draw Noisy Target (White Square)
    if (telemetry.target_visible) {
        camCtx.fillStyle = 'white';
        camCtx.fillRect(telemetry.noisy_relative.x - 5, telemetry.noisy_relative.y - 5, 10, 10);
    } else {
        camCtx.fillStyle = 'red';
        camCtx.font = 'bold 20px sans-serif';
        camCtx.fillText("TARGET LOST - KALMAN PREDICTING", 20, 40);
    }
    
    // Draw Kalman Prediction (Green Bounding Box)
    camCtx.strokeStyle = '#00FF00';
    camCtx.lineWidth = 2;
    camCtx.strokeRect(telemetry.kalman_pred.x - 10, telemetry.kalman_pred.y - 10, 20, 20);
    
  }, [telemetry]);

  const downloadLog = () => {
    const csvRows = [
      ['Timestamp', 'TargetX', 'TargetY', 'CamX', 'CamY', 'ErrX', 'ErrY', 'PanVel', 'TiltVel']
    ];
    
    logs.forEach(log => {
      csvRows.push([
        log.timestamp,
        log.target_global.x.toFixed(2),
        log.target_global.y.toFixed(2),
        log.camera_global.x.toFixed(2),
        log.camera_global.y.toFixed(2),
        log.error.x.toFixed(2),
        log.error.y.toFixed(2),
        log.pan_vel.toFixed(4),
        log.tilt_vel.toFixed(4)
      ]);
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "telemetry_log.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#1e1e1e', color: 'white', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>ISRO SIH26169 Camera Tracking Simulation</h1>
      
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
        
        {/* Panel 1: Radar View */}
        <div style={{ backgroundColor: '#2d2d2d', padding: '15px', borderRadius: '8px' }}>
          <h3>Radar View (2000x2000 scaled to 200x200)</h3>
          <canvas ref={radarCanvasRef} width={200} height={200} style={{ border: '1px solid #444', backgroundColor: '#111' }}></canvas>
          <div style={{ marginTop: '10px', fontSize: '14px' }}>
            <span style={{ color: 'red' }}>● Target</span> | <span style={{ color: 'blue' }}>■ Camera</span>
          </div>
        </div>

        {/* Panel 2: Camera Feed */}
        <div style={{ backgroundColor: '#2d2d2d', padding: '15px', borderRadius: '8px' }}>
          <h3>Camera Feed (640x480)</h3>
          <canvas ref={cameraCanvasRef} width={640} height={480} style={{ border: '1px solid #444' }}></canvas>
        </div>

        {/* Panel 3: Live Telemetry */}
        <div style={{ backgroundColor: '#2d2d2d', padding: '15px', borderRadius: '8px', minWidth: '300px' }}>
          <h3>Live Telemetry</h3>
          {telemetry ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '16px' }}>
              <div><strong>FPS:</strong> {fps}</div>
              <div><strong>Weather:</strong> {telemetry.weather ? telemetry.weather.toUpperCase() : 'CLEAR'}</div>
              <div><strong>Tracking Error (px):</strong> 
                <br/>X: {telemetry.error.x.toFixed(2)} | Y: {telemetry.error.y.toFixed(2)}
              </div>
              <div><strong>Pan Vel (deg/s):</strong> {telemetry.pan_vel.toFixed(4)}</div>
              <div><strong>Tilt Vel (deg/s):</strong> {telemetry.tilt_vel.toFixed(4)}</div>
              <div><strong>Target Global:</strong> 
                <br/>({telemetry.target_global.x.toFixed(1)}, {telemetry.target_global.y.toFixed(1)})
              </div>
              <div><strong>Camera Global:</strong> 
                <br/>({telemetry.camera_global.x.toFixed(1)}, {telemetry.camera_global.y.toFixed(1)})
              </div>
            </div>
          ) : (
            <div>Waiting for data...</div>
          )}
          
          <button onClick={downloadLog} style={{ marginTop: '20px', padding: '10px', cursor: 'pointer', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', fontSize: '16px', width: '100%' }}>
            Download Log (CSV)
          </button>
        </div>
        
      </div>
    </div>
  );
}

export default App;
