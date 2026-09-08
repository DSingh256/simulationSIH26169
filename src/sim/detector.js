// Simulates reading pixels from the WebGL context to detect the bright "glint"
// Since a full blob detection on JS main thread is slow, we'll do a naive 
// bright-pixel search on a downsampled grid, or we can use the ground truth 
// point and add noise to simulate the detection failure rate.
// The prompt said: "read pixels off the canvas, don't cheat"
// So we will literally read a small block of pixels if we know roughly where to look,
// or we read a downsampled grid.

export function detectBlob(gl, width, height, pixelRatio = 1) {
  const step = 8; // downsample to speed up JS array traversal
  const w = Math.floor(width / step);
  const h = Math.floor(height / step);
  
  const buffer = new Uint8Array(width * height * 4);
  try {
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
  } catch (e) {
    return [];
  }
  
  const threshold = 180;
  let brightPixels = [];
  
  // 1. Thresholding
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const r = buffer[idx];
      const g = buffer[idx + 1];
      const b = buffer[idx + 2];
      const brightness = (r + g + b) / 3;
      
      if (brightness > threshold) {
        brightPixels.push({ x, y: height - y, brightness }); // y flipped for screen coords
      }
    }
  }
  
  // 2. Connected-component extraction (simple distance clustering)
  const blobs = [];
  const distanceThreshold = 50;
  
  for (const p of brightPixels) {
    let merged = false;
    for (const blob of blobs) {
      const dx = p.x - blob.cx;
      const dy = p.y - blob.cy;
      if (Math.sqrt(dx*dx + dy*dy) < distanceThreshold) {
        blob.pixels.push(p);
        blob.sumX += p.x;
        blob.sumY += p.y;
        blob.sumBrightness += p.brightness;
        blob.cx = blob.sumX / blob.pixels.length;
        blob.cy = blob.sumY / blob.pixels.length;
        
        blob.minX = Math.min(blob.minX, p.x);
        blob.maxX = Math.max(blob.maxX, p.x);
        blob.minY = Math.min(blob.minY, p.y);
        blob.maxY = Math.max(blob.maxY, p.y);
        
        merged = true;
        break;
      }
    }
    
    if (!merged) {
      blobs.push({
        pixels: [p],
        sumX: p.x, sumY: p.y,
        sumBrightness: p.brightness,
        cx: p.x, cy: p.y,
        minX: p.x, maxX: p.x,
        minY: p.y, maxY: p.y
      });
    }
  }
  
  // 3. Compute stats for each blob
  const candidates = blobs.map(blob => {
    const size = blob.pixels.length;
    const meanIntensity = blob.sumBrightness / size;
    
    let variance = 0;
    for (const p of blob.pixels) {
      variance += Math.pow(p.brightness - meanIntensity, 2);
    }
    variance /= size;
    
    // Classical confidence heuristic:
    // Favors compact blobs with high intensity and low variance
    let confidence = Math.min(1.0, size / 20.0);
    if (meanIntensity > 220) confidence = Math.max(confidence, 0.8);
    if (variance > 1000) confidence *= 0.5; // too noisy
    
    const wBox = Math.max(20, (blob.maxX - blob.minX) + 10);
    const hBox = Math.max(20, (blob.maxY - blob.minY) + 10);
    
    return {
      box: { 
        x: blob.cx / pixelRatio, 
        y: blob.cy / pixelRatio, 
        width: wBox / pixelRatio, 
        height: hBox / pixelRatio 
      },
      size,
      meanIntensity,
      variance,
      confidence
    };
  });
  
  return candidates;
}
