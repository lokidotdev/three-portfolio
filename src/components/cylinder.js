import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import { CYLINDER, TEXT, CYLINDER_TEXTURE_URLS } from "@/config/sceneConfig";
import { makePlaneMat, makeTextMat } from "./materials";
import { createFloor } from "./reflector";

const FONT_URL = "/fonts/helvetiker_regular.typeface.json";

// Builds the perspective "cylinder" pass: a ring of textured panels with
// floating glass titles, standing on a reflective floor. Kept in its own scene
// and camera so it has real 3D depth while the flat text effect stays a
// full-screen layer behind it.
//
// Returns the scene, camera, groups, materials, (re)build functions, and a
// dispose() for teardown.
export const createCylinder = (renderer) => {
  const cylScene = new THREE.Scene();

  // Environment map: only the physical (glass) text samples this, giving the
  // letters real reflections/refraction highlights. The panels and floor use
  // custom shaders and are unaffected.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  cylScene.environment = envTexture;

  const cylCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  const camBase = new THREE.Vector3(0, 1.3, 6.4); // near eye-level, slight downward look
  cylCamera.position.copy(camBase);
  cylCamera.lookAt(0, 0, 0);

  // cylRoot carries the tilt; cylGroup (the planes) spins inside it. The
  // reflective floor is NOT parented here — it stays flat and level regardless
  // of the cylinder's tilt.
  const cylRoot = new THREE.Group();
  cylRoot.rotation.x = CYLINDER.tilt;
  cylScene.add(cylRoot);

  const cylGroup = new THREE.Group();
  cylRoot.add(cylGroup);

  const dpr = Math.min(window.devicePixelRatio, 2);
  const floor = createFloor(dpr);
  floor.rotation.x = -Math.PI / 2; // lay flat, facing up
  cylScene.add(floor); // level, independent of the cylinder tilt

  // Cylinder textures, cycled across the ring's planes.
  const cylTextures = CYLINDER_TEXTURE_URLS.map(({ src }) => {
    const tex = new THREE.TextureLoader().load(src);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  });
  const planeMats = cylTextures.map(makePlaneMat);
  const textMats = CYLINDER_TEXTURE_URLS.map(() => makeTextMat());

  // Title text sits in its own group so it can be rebuilt independently once
  // the font finishes loading, without disturbing the panel ring.
  const textGroup = new THREE.Group();
  cylGroup.add(textGroup);
  let font = null;

  // (Re)build the floating 3D titles, one per panel, centred both horizontally
  // and vertically and pushed slightly in front of the panel.
  const buildText = () => {
    for (const child of [...textGroup.children]) {
      textGroup.remove(child);
      child.traverse((o) => o.geometry && o.geometry.dispose());
    }
    if (!font) return;
    const R = CYLINDER.radius;
    // Bend flat geometry around the ring axis in place (local x -> angle),
    // matching the panels' shader bend, then recompute normals for the curve.
    const bendGeometry = (geo) => {
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const phi = x / R;
        const r = R + z;
        pos.setXYZ(i, r * Math.sin(phi), y, r * Math.cos(phi) - R);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    };
    const seg = Math.max(3, Math.round(CYLINDER.segments));
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const { title } = CYLINDER_TEXTURE_URLS[i % CYLINDER_TEXTURE_URLS.length];
      const geo = new TextGeometry(title, {
        font,
        size: TEXT.size,
        depth: TEXT.depth,
        curveSegments: 8,
        bevelEnabled: false,
      });
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      // Centre the text on its own origin (both axes) so it lands centred once
      // positioned on the ring.
      geo.translate(
        -(bb.max.x + bb.min.x) / 2,
        -(bb.max.y + bb.min.y) / 2,
        -(bb.max.z + bb.min.z) / 2
      );
      bendGeometry(geo);
      const mesh = new THREE.Mesh(geo, textMats[i % textMats.length]);
      // Push outward from the panel surface, along the wrapper's local z.
      mesh.position.z = CYLINDER.depth / 2 + TEXT.offset;
      // Wrapper matches the panel's own position/orientation exactly.
      const wrapper = new THREE.Group();
      wrapper.position.set(
        Math.cos(a) * CYLINDER.radius,
        0,
        Math.sin(a) * CYLINDER.radius
      );
      wrapper.rotation.y = Math.PI / 2 - a;
      wrapper.add(mesh);
      textGroup.add(wrapper);
    }
  };

  // (Re)build the ring. Called on init and whenever a structural GUI value
  // (segments / radius / height / gap) changes.
  const buildCylinder = () => {
    for (const child of [...cylGroup.children]) {
      if (child === textGroup) continue;
      cylGroup.remove(child);
      child.geometry.dispose();
    }
    const seg = Math.max(3, Math.round(CYLINDER.segments));
    for (const mat of planeMats) mat.uniforms.uRadius.value = CYLINDER.radius;
    // Arc length of one segment (the box is bent to this arc in the shader, so
    // its width must be the arc length for neighbours to meet on the ring).
    const arc = ((2 * Math.PI * CYLINDER.radius) / seg) * (1 - CYLINDER.gap);
    // Subdivide across the width so the shader-bend renders as a smooth curve.
    const widthSegs = Math.max(2, Math.ceil(64 / seg));
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const geo = new THREE.BoxGeometry(
        arc,
        CYLINDER.height,
        CYLINDER.depth,
        widthSegs,
        1,
        1
      );
      const mesh = new THREE.Mesh(geo, planeMats[i % planeMats.length]);
      mesh.position.set(
        Math.cos(a) * CYLINDER.radius,
        0,
        Math.sin(a) * CYLINDER.radius
      );
      // Orient each box tangent to the ring, facing outward.
      mesh.rotation.y = Math.PI / 2 - a;
      cylGroup.add(mesh);
    }
    buildText();
    // Keep the level floor just below the cylinder base (base gap), and size it
    // to the ring.
    floor.position.y = -(CYLINDER.height / 2 + CYLINDER.baseGap);
    floor.scale.setScalar(CYLINDER.radius * 1.6);
  };

  new FontLoader().load(FONT_URL, (loaded) => {
    font = loaded;
    buildText();
  });
  buildCylinder();

  const dispose = () => {
    for (const child of cylGroup.children) {
      if (child === textGroup) continue;
      child.geometry.dispose();
    }
    textGroup.traverse((o) => o.geometry && o.geometry.dispose());
    for (const mat of planeMats) mat.dispose();
    for (const mat of textMats) mat.dispose();
    for (const tex of cylTextures) tex.dispose();
    floor.geometry.dispose();
    floor.dispose();
    envTexture.dispose();
    pmrem.dispose();
  };

  return {
    cylScene,
    cylCamera,
    camBase,
    cylRoot,
    cylGroup,
    floor,
    planeMats,
    textMats,
    buildCylinder,
    buildText,
    dispose,
  };
};
