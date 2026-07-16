import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import Experience from "../Experience.js";

import { CYLINDER, INTRO } from "../sceneConfig.js";

// Adds a `reflectivity` uniform that blends the mirror toward the white base
// colour, so 0 = plain white floor and 1 = full reflection.
// (MeshPhysicalMaterial.reflectivity only mirrors an environment map, so
// Reflector is used to reflect the actual scene geometry.)
const reflectorShader = {
  name: "AdjustableReflectorShader",
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    reflectivity: { value: CYLINDER.reflectivity },
    baseColor: { value: new THREE.Color(0xffffff) },
    // Reflection is full within fadeStart of the base and fully faded by
    // fadeEnd (both in disk radius, 0..1).
    fadeStart: { value: CYLINDER.reflectionFadeStart },
    fadeEnd: { value: CYLINDER.reflectionFadeEnd },
    introOpacity: { value: 1 },
  },
  // vLocal carries the disk's local xy (radius 0..1) so the fragment can fade
  // the reflection out with distance from the cylinder base.
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vLocal;
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4( position, 1.0 );
      vLocal = position.xy;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform vec3 baseColor;
    uniform float reflectivity;
    uniform float fadeStart;
    uniform float fadeEnd;
    uniform float introOpacity;
    uniform sampler2D tDiffuse;
    varying vec4 vUv;
    varying vec2 vLocal;

    #include <logdepthbuf_pars_fragment>

    float blendOverlay( float base, float blend ) {
      return ( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );
    }
    vec3 blendOverlay( vec3 base, vec3 blend ) {
      return vec3( blendOverlay( base.r, blend.r ), blendOverlay( base.g, blend.g ), blendOverlay( base.b, blend.b ) );
    }

    void main() {
      #include <logdepthbuf_fragment>
      vec4 base = texture2DProj( tDiffuse, vUv );
      vec3 reflection = blendOverlay( base.rgb, color );
      // Strong under the base, fading out toward the edge. The reflection fades
      // to transparent (not white) so the scene behind shows through instead of
      // an opaque disk.
      float fade = 1.0 - smoothstep( fadeStart, fadeEnd, length( vLocal ) );
      gl_FragColor = vec4( reflection, reflectivity * fade * introOpacity );
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

// The reflective base: a true planar mirror that reflects the cylinder above it.
export default class Floor {
  constructor() {
    this.experience = new Experience();
    this.debug = this.experience.debug;

    this.setInstance();
    this.frame();
    // Starts hidden and below its resting height when the intro will play it in.
    this.setIntro(this.experience.world.intro.active ? 0 : 1);
    this.setDebug();
  }

  setInstance() {
    const dpr = this.experience.sizes.pixelRatio;
    this.instance = new Reflector(new THREE.CircleGeometry(1, 96), {
      textureWidth: 1024 * dpr,
      textureHeight: 1024 * dpr,
      color: 0x808080, // neutral: overlay becomes identity, faithful mirror
      clipBias: 0.003,
      shader: reflectorShader,
    });
    // The shader fades the reflection to alpha 0 at the edges, so blend it over
    // the scene instead of drawing an opaque disk.
    this.instance.material.transparent = true;
    this.instance.rotation.x = -Math.PI / 2; // lay flat, facing up
    // Parented to the ring's tilt group, so the base tilts with the cylinder.
    this.experience.world.cylinder.root.add(this.instance);
  }

  // Sit just below the cylinder base and size to the ring.
  frame() {
    this.restY = -(CYLINDER.height / 2 + CYLINDER.baseGap);
    this.instance.scale.setScalar(CYLINDER.radius * CYLINDER.floorScale);
    this.setIntro(this.introProgress ?? 1);
  }

  setIntro(progress) {
    this.introProgress = progress;
    this.instance.material.uniforms.introOpacity.value = progress;
    this.instance.position.y = this.restY - INTRO.floorRise * (1 - progress);
  }

  setDebug() {
    this.debug.whenReady((ui) => {
      const uniforms = this.instance.material.uniforms;
      const folder = ui.addFolder("Floor");
      folder
        .add(CYLINDER, "baseGap", 0, 2, 0.01)
        .name("base gap")
        .onChange(() => this.frame());
      folder
        .add(CYLINDER, "floorScale", 0.5, 5, 0.05)
        .name("floor radius")
        .onChange(() => this.frame());
      folder
        .add(CYLINDER, "reflectivity", 0, 1, 0.01)
        .name("reflectivity")
        .onChange((v) => (uniforms.reflectivity.value = v));
      folder
        .add(CYLINDER, "reflectionFadeStart", 0, 2, 0.01)
        .name("reflect fade start")
        .onChange((v) => (uniforms.fadeStart.value = v));
      folder
        .add(CYLINDER, "reflectionFadeEnd", 0, 4, 0.01)
        .name("reflect fade end")
        .onChange((v) => (uniforms.fadeEnd.value = v));
    });
  }

  destroy() {
    this.instance.geometry.dispose();
    this.instance.dispose();
    this.instance.removeFromParent();
  }
}
