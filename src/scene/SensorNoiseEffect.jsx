import { Effect } from 'postprocessing';
import { Uniform } from 'three';
import React, { forwardRef, useMemo } from 'react';
import { useSimStore } from '../store/simStore';
import { useFrame } from '@react-three/fiber';

const fragmentShader = `
uniform float time;
uniform float strength;
uniform float resolutionY;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec4 color = texture2D(inputBuffer, uv);
  
  // Sensor grain
  float noise = (random(uv + mod(time, 10.0)) - 0.5) * strength;
  color.rgb += noise;
  
  // Scanlines
  float scanline = sin(uv.y * resolutionY * 2.0) * 0.04 * strength;
  color.rgb -= scanline;
  
  // IR tint / Monochrome-ish tracking feed look (optional, maybe greenish or just desaturated)
  float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  vec3 tinted = vec3(luma * 0.8, luma * 1.2, luma * 0.8); // subtle green tint
  
  // Mix based on a hardcoded "night vision" style or just keep it realistic B&W
  color.rgb = mix(vec3(luma), tinted, 0.3);

  outputColor = color;
}
`;

class SensorNoiseEffectImpl extends Effect {
  constructor() {
    super('SensorNoiseEffect', fragmentShader, {
      uniforms: new Map([
        ['time', new Uniform(0)],
        ['strength', new Uniform(0.5)],
        ['resolutionY', new Uniform(window.innerHeight)]
      ])
    });
  }
  update(renderer, inputBuffer, deltaTime) {
    this.uniforms.get('time').value += deltaTime;
    this.uniforms.get('resolutionY').value = window.innerHeight;
  }
}

export const SensorNoiseEffect = forwardRef((props, ref) => {
  const effect = useMemo(() => new SensorNoiseEffectImpl(), []);
  const strength = useSimStore(state => state.noiseStrength);
  
  useFrame(() => {
    effect.uniforms.get('strength').value = strength;
  });

  return <primitive ref={ref} object={effect} dispose={null} />;
});
