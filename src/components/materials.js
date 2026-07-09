import * as THREE from "three";

import { CYLINDER, TEXT } from "@/config/sceneConfig";

// Opaque card material for a cylinder panel. The artwork (black text) is
// composited over a solid card colour using the texture's alpha, so the whole
// plane is a visible surface (not just the floating text) and the transparent
// gray of the PNG never shows. One material per cylinder texture; planes pick
// from these in a loop.
export const makePlaneMat = (tex) =>
  new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uMap: { value: tex },
      uRadius: { value: CYLINDER.radius },
      uCardColor: {
        value: new THREE.Color().fromArray(
          CYLINDER.planeColor.map((v) => v / 255)
        ),
      },
    },
    // Bend the flat box into a cylindrical arc: local x becomes an angle
    // around the ring axis (phi = x / R), so every vertex lands exactly on
    // radius R (offset by its local depth). With enough width segments the
    // ring reads as a smooth, rounded cylinder rather than flat facets.
    vertexShader: /* glsl */ `
      uniform float uRadius;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        float phi = position.x / uRadius;
        float r = uRadius + position.z;
        vec3 p = vec3(
          r * sin( phi ),
          position.y,
          r * cos( phi ) - uRadius
        );
        gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uCardColor;
      varying vec2 vUv;
      void main() {
        vec4 t = texture2D( uMap, vUv );
        gl_FragColor = vec4( mix( uCardColor, t.rgb, t.a ), 1.0 );
      }`,
  });

// Real glass material for the floating 3D title text: physically-based
// transmission refracts the panel behind each letter (rather than a flat
// semi-transparent overlay), with a clearcoat sheen for a glassy surface.
// The cylindrical bend is baked into the geometry (see buildText) since a
// transmission material can't run the panels' custom bend vertex shader.
export const makeTextMat = () =>
  new THREE.MeshPhysicalMaterial({
    color: new THREE.Color().fromArray(TEXT.color.map((v) => v / 255)),
    metalness: 0,
    roughness: TEXT.roughness,
    transmission: TEXT.transmission,
    thickness: TEXT.thickness,
    ior: TEXT.ior,
    transparent: true,
    clearcoat: TEXT.clearcoat,
    clearcoatRoughness: TEXT.clearcoatRoughness,
    reflectivity: TEXT.reflectivity,
    specularIntensity: TEXT.specularIntensity,
    envMapIntensity: TEXT.envMapIntensity,
    attenuationColor: new THREE.Color().fromArray(
      TEXT.attenuationColor.map((v) => v / 255)
    ),
    attenuationDistance: TEXT.attenuationDistance,
    dispersion: TEXT.dispersion,
    iridescence: TEXT.iridescence,
    iridescenceIOR: TEXT.iridescenceIOR,
    side: THREE.DoubleSide,
  });
