import * as THREE from "three";

import vertexShader from "@/shaders/text.vertex.glsl";
import fragmentShader from "@/shaders/text.fragment.glsl";
import { CONFIG, TEXTURE_URL } from "@/config/sceneConfig";

// Builds the flat, full-screen distortion effect: the portfolio artwork drawn
// on an orthographic quad, warped by the pointer via a custom shader.
// Returns the material and the texture (so the caller can dispose it).
export const createTextEffect = () => {
  const texture = new THREE.TextureLoader().load(TEXTURE_URL, (tex) => {
    material.uniforms.uTexAspect.value = tex.image.width / tex.image.height;
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTexture: { value: texture },
      uTime: { value: 0 },
      uHover: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uMoveDir: { value: new THREE.Vector2(1, 0) },
      uTexAspect: { value: 2041 / 926 },
      uScreenAspect: { value: 1 },
      // Tunable effect params (see CONFIG / dat.GUI).
      uStrength: { value: CONFIG.strength },
      uRippleStrength: { value: CONFIG.rippleStrength },
      uPushStrength: { value: CONFIG.pushStrength },
      uCAStrength: { value: CONFIG.caStrength },
      uGlowStrength: { value: CONFIG.glowStrength },
      uWaveFreq: { value: CONFIG.waveFreq },
      uWaveSpeed: { value: CONFIG.waveSpeed },
      uFalloff: { value: CONFIG.falloff },
      uRadius: { value: CONFIG.radius },
      uSpreadAlong: { value: CONFIG.spreadAlong },
      uSpreadAcross: { value: CONFIG.spreadAcross },
      uGlowColor: {
        value: new THREE.Color().fromArray(
          CONFIG.glowColor.map((c) => c / 255)
        ),
      },
    },
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);

  return { material, mesh, texture };
};
