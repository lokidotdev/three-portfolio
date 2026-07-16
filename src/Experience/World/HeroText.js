import * as THREE from "three";
import Experience from "../Experience.js";

import vertexShader from "../shaders/text.vertex.glsl";
import fragmentShader from "../shaders/text.fragment.glsl";
import { CONFIG, HERO_TEXT, INTRO } from "../sceneConfig.js";
import { makeHeroTextTexture } from "./heroTextTexture.js";

// The flat, full-screen pass behind the ring: the hero text on an orthographic
// quad, warped by the pointer. Owns its own scene and camera — the renderer
// draws it first, then the cylinder on top.
export default class HeroText {
  constructor() {
    this.experience = new Experience();
    this.sizes = this.experience.sizes;
    this.time = this.experience.time;
    this.pointer = this.experience.pointer;
    this.debug = this.experience.debug;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // `current` always holds the texture the material is sampling, so it can be
    // disposed on swap/teardown.
    this.current = makeHeroTextTexture(HERO_TEXT, this.sizes.aspect);

    this.setMaterial();
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.scene.add(this.mesh);

    this.setDebug();
  }

  setMaterial() {
    const { texture, aspect, band } = this.current;
    const slide = (band.top - band.bottom) * INTRO.textSlide;

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTexture: { value: texture },
        uTime: { value: 0 },
        // Intro reveal: 0 -> 1 rises the text into view behind a fixed clip
        // line at its baseline, with a left->right stagger. >= 1 = disabled.
        uIntro: { value: this.experience.world.intro.active ? 0 : 1 },
        uIntroStagger: { value: INTRO.textStagger },
        uIntroSlide: { value: slide },
        uTextMaskLine: { value: band.bottom },
        uTextMaskTop: { value: band.top },
        // Focus exit: the same stagger, sliding up and out through the top clip
        // line as a panel straightens. Reverses on return.
        uExit: { value: 0 },
        uExitSlide: { value: slide },
        uHover: { value: 0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uMoveDir: { value: new THREE.Vector2(1, 0) },
        uTexAspect: { value: aspect },
        uScreenAspect: { value: this.sizes.aspect },
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
  }

  setIntro(progress) {
    this.material.uniforms.uIntro.value = progress;
  }

  setExit(progress) {
    this.material.uniforms.uExit.value = progress;
  }

  // Redraw the text for a new viewport aspect and repoint the uniforms at it.
  // The reveal/exit slides and clip lines are measured off the drawn glyphs, so
  // they have to be refreshed alongside the texture.
  setAspect(aspect) {
    if (Math.abs(aspect - this.current.aspect) < 0.01) return;
    const next = makeHeroTextTexture(HERO_TEXT, aspect);
    this.current.texture.dispose();
    this.current = next;

    const slide = (next.band.top - next.band.bottom) * INTRO.textSlide;
    const u = this.material.uniforms;
    u.uTexture.value = next.texture;
    u.uTexAspect.value = next.aspect;
    u.uIntroSlide.value = slide;
    u.uExitSlide.value = slide;
    u.uTextMaskLine.value = next.band.bottom;
    u.uTextMaskTop.value = next.band.top;
  }

  setDebug() {
    this.debug.whenReady((ui) => {
      const u = this.material.uniforms;
      const folder = ui.addFolder("Distortion");
      folder.add(u.uStrength, "value", 0, 3, 0.01).name("strength");
      folder.add(u.uPushStrength, "value", 0, 0.1, 0.001).name("push");
      folder.add(u.uRippleStrength, "value", 0, 0.1, 0.001).name("ripple");
      folder.add(u.uRadius, "value", 0.1, 4, 0.05).name("radius");
      folder.add(u.uSpreadAlong, "value", 0.2, 5, 0.05).name("spread along");
      folder.add(u.uSpreadAcross, "value", 0.2, 5, 0.05).name("spread across");
      folder.add(u.uCAStrength, "value", 0, 0.03, 0.0005).name("chromatic");
      folder.add(u.uGlowStrength, "value", 0, 12, 0.1).name("glow");
      folder.add(u.uWaveFreq, "value", 2, 80, 1).name("wave freq");
      folder.add(u.uWaveSpeed, "value", 0, 20, 0.1).name("wave speed");
      folder.add(u.uFalloff, "value", 1, 20, 0.1).name("falloff");
      folder
        .addColor(CONFIG, "glowColor")
        .name("glow color")
        .onChange((c) => u.uGlowColor.value.fromArray(c.map((v) => v / 255)));
    });
  }

  // Redrawing allocates a canvas and re-uploads a texture, so it's debounced —
  // dragging a window edge would otherwise rebuild it on every frame.
  resize() {
    this.material.uniforms.uScreenAspect.value = this.sizes.aspect;
    clearTimeout(this.redraw);
    this.redraw = setTimeout(() => this.setAspect(this.sizes.aspect), 150);
  }

  update() {
    const u = this.material.uniforms;
    u.uMouse.value.copy(this.pointer.current);
    u.uMoveDir.value.copy(this.pointer.moveDir).normalize();
    u.uHover.value = this.pointer.hover;
    u.uTime.value = this.time.elapsed;
  }

  destroy() {
    clearTimeout(this.redraw);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.current.texture.dispose();
  }
}
