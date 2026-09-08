import { Effect } from 'postprocessing';
import { Uniform } from 'three';
import React, { forwardRef, useMemo } from 'react';
import { useSimStore } from '../store/simStore';
import { useFrame } from '@react-three/fiber';

const fragmentShader = `
uniform float time;
uniform float strength;

// Simple pseudo-random 2D noise
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Basic perlin-like noise
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
             mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
}

// FBM for more turbulence
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
  for (int i = 0; i < 4; ++i) {
    v += a * noise(p);
    p = rot * p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Screen-space warp
  vec2 offset = vec2(
    fbm(uv * 10.0 + time * 0.5) - 0.5,
    fbm(uv * 10.0 - time * 0.5 + 100.0) - 0.5
  );
  
  vec2 warpedUv = uv + offset * strength * 0.05;
  outputColor = texture2D(inputBuffer, warpedUv);
}
`;

class TurbulenceEffectImpl extends Effect {
  constructor() {
    super('TurbulenceEffect', fragmentShader, {
      uniforms: new Map([
        ['time', new Uniform(0)],
        ['strength', new Uniform(0.5)]
      ])
    });
  }
  update(renderer, inputBuffer, deltaTime) {
    this.uniforms.get('time').value += deltaTime;
  }
}

export const TurbulenceEffect = forwardRef((props, ref) => {
  const effect = useMemo(() => new TurbulenceEffectImpl(), []);
  const strength = useSimStore(state => state.turbulenceStrength);
  
  useFrame(() => {
    effect.uniforms.get('strength').value = strength;
  });

  return <primitive ref={ref} object={effect} dispose={null} />;
});
