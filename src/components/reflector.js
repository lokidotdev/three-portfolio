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
      // Strong under the base, fading to the white floor toward the edge.
      float fade = 1.0 - smoothstep( 0.15, 0.85, length( vLocal ) );
      gl_FragColor = vec4( mix( baseColor, reflection, reflectivity * fade ), 1.0 );
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

// Reflective base — a true planar mirror that reflects the cylinder above it.
export const createFloor = (dpr) =>
  new Reflector(new THREE.CircleGeometry(1, 96), {
    textureWidth: 1024 * dpr,
    textureHeight: 1024 * dpr,
    color: 0x808080, // neutral: overlay becomes identity, faithful mirror
    clipBias: 0.003,
    shader: reflectorShader,
  });
