import * as THREE from "three";

import vertexShader from "@/shaders/text.vertex.glsl";
import fragmentShader from "@/shaders/text.fragment.glsl";
import { CONFIG, INTRO } from "@/config/sceneConfig";
import { makeTextTexture } from "./textCanvas";

// Builds the flat, full-screen distortion effect: the hero text drawn on an
// orthographic quad, warped by the pointer via a custom shader. The text is
// generated at runtime into a canvas texture (see textCanvas.js / HERO_TEXT) so
// it's editable in code rather than a baked PNG.
// Returns the material and the texture (so the caller can dispose it).
export const createTextEffect = () => {
  const { texture, aspect, band } = makeTextTexture();

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTexture: { value: texture },
      uTime: { value: 0 },
      // Intro reveal: uIntro 0->1 rises the hero text into view behind a fixed
      // clip line at its baseline, with a left->right stagger. >=1 = disabled.
      uIntro: { value: 1 },
      uIntroStagger: { value: INTRO.textStagger },
      // Distance the glyphs start below the clip line (texture-uv), enough to
      // push the whole band under the line so it's fully hidden at uIntro = 0.
      uIntroSlide: { value: (band.top - band.bottom) * INTRO.textSlide },
      uTextMaskLine: { value: band.bottom },
      uTextMaskTop: { value: band.top },
      // Focus exit: the same stagger, sliding the text up and out through the
      // top clip line as a panel straightens (uExit 0->1). Reverses on return.
      uExit: { value: 0 },
      uExitSlide: { value: (band.top - band.bottom) * INTRO.textSlide },
      uHover: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uMoveDir: { value: new THREE.Vector2(1, 0) },
      uTexAspect: { value: aspect },
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
