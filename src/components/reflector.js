import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";

import { CYLINDER } from "@/config/sceneConfig";

// Custom shader for the reflective floor. Adds a `reflectivity` uniform that
// blends the mirror toward the white base colour, so 0 = plain white floor and
// 1 = full reflection. (MeshPhysicalMaterial.reflectivity only mirrors an
// environment map, so Reflector is used to reflect the actual scene geometry.)
const reflectorShader = {
  name: "AdjustableReflectorShader",
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    reflectivity: { value: CYLINDER.reflectivity },
    baseColor: { value: new THREE.Color(0xffffff) },
    // Reflection reaches full strength within fadeStart of the base and fully
    // fades to the white floor by fadeEnd (both in disk radius, 0..1).
    fadeStart: { value: CYLINDER.reflectionFadeStart },
    fadeEnd: { value: CYLINDER.reflectionFadeEnd },
    // One-time intro fade (0 = invisible, 1 = full). Driven by the load sequence.
    introOpacity: { value: 1 },
  },
  // vLocal carries the disk's local xy (radius 0..1) so the fragment can
  // fade the reflection out with distance from the cylinder base.
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
      // Strong under the base, fading out toward the edge. The reflection
      // fades to transparent (not white) so the scene behind shows through
      // instead of an opaque disk.
      float fade = 1.0 - smoothstep( fadeStart, fadeEnd, length( vLocal ) );
      gl_FragColor = vec4( reflection, reflectivity * fade * introOpacity );
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

// Reflective base — a true planar mirror that reflects the cylinder above it.
export const createFloor = (dpr) => {
  const floor = new Reflector(new THREE.CircleGeometry(1, 96), {
    textureWidth: 1024 * dpr,
    textureHeight: 1024 * dpr,
    color: 0x808080, // neutral: overlay becomes identity, faithful mirror
    clipBias: 0.003,
    shader: reflectorShader,
  });
  // The shader fades the reflection to alpha 0 at the edges, so blend it over
  // the scene instead of drawing an opaque disk.
  floor.material.transparent = true;
  return floor;
};
