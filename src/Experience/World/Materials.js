import * as THREE from "three";

import { CYLINDER, TEXT } from "../sceneConfig.js";

// Opaque card material for a cylinder panel: the artwork (black text on
// transparent) is composited over a solid card colour using its alpha, so the
// whole plane is a visible surface. One material per panel texture.
//
// NOTE: kept OPAQUE by default. The floating titles are a transmission
// material, and three.js only renders opaque objects into the buffer that
// transmission refracts — a `transparent` panel would vanish from behind the
// glass letters. Panels flip to `transparent` only while they fade out during a
// focus transition (see Focus.begin), then flip back.
export const makePanelMaterial = (map) =>
  new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uMap: { value: map },
      uRadius: { value: CYLINDER.radius },
      uBend: { value: 1 },
      uOpacity: { value: 1 },
      uCardColor: {
        value: new THREE.Color().fromArray(
          CYLINDER.planeColor.map((v) => v / 255)
        ),
      },
    },
    // Bend the flat box into a cylindrical arc: local x becomes an angle around
    // the ring axis (phi = x / R), so every vertex lands on radius R (offset by
    // its local depth). uBend blends between the flat box (0) and the bent arc
    // (1), so a selected panel can straighten in place.
    vertexShader: /* glsl */ `
      uniform float uRadius;
      uniform float uBend;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        float phi = position.x / uRadius;
        float r = uRadius + position.z;
        vec3 bent = vec3(
          r * sin( phi ),
          position.y,
          r * cos( phi ) - uRadius
        );
        vec3 p = mix( position, bent, uBend );
        gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uCardColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec4 t = texture2D( uMap, vUv );
        gl_FragColor = vec4( mix( uCardColor, t.rgb, t.a ), uOpacity );
      }`,
  });

// Real glass for the floating 3D titles: physically-based transmission refracts
// the panel behind each letter, with a clearcoat sheen on top. The cylindrical
// bend is baked into the geometry (see Titles.build) since a transmission
// material can't run the panels' custom bend vertex shader.
export const makeTitleMaterial = () => {
  const material = new THREE.MeshPhysicalMaterial({
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
  // uBend blends the letters between their flat form (aFlat, uBend = 0) and the
  // ring-bent geometry baked into `position` (uBend = 1), so a focused title
  // straightens in step with its panel. Kept on userData (not a closure) so it
  // survives material.clone() and binds to `this` per material.
  material.userData.uBend = { value: 1 };
  material.onBeforeCompile = function (shader) {
    shader.uniforms.uBend = this.userData.uBend;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec3 aFlat;\nuniform float uBend;"
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\ntransformed = mix( aFlat, transformed, uBend );"
      );
  };
  return material;
};
