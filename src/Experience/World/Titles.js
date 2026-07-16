import * as THREE from "three";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import Experience from "../Experience.js";

import { CYLINDER, PANELS, TEXT } from "../sceneConfig.js";
import { makeTitleMaterial } from "./Materials.js";

// The floating 3D glass titles, one per panel, centred on the panel and pushed
// slightly in front of it. They live in their own group inside the ring so they
// can be rebuilt without disturbing the panels.
export default class Titles {
  constructor() {
    this.experience = new Experience();
    this.debug = this.experience.debug;
    this.font = this.experience.resources.items.titleFont;

    this.materials = PANELS.map(() => makeTitleMaterial());
    this.group = new THREE.Group();
    this.experience.world.cylinder.group.add(this.group);

    this.build();
    this.setDebug();
  }

  // A panel's title wrapper, paired by stable ring index rather than child
  // order (which changes as panels are removed/re-added during a focus).
  find(index) {
    return (
      this.group.children.find((wrapper) => wrapper.userData.index === index) ||
      null
    );
  }

  // Bend flat geometry around the ring axis in place (local x -> angle),
  // matching the panels' shader bend, then recompute normals for the curve.
  bendGeometry(geometry) {
    const R = CYLINDER.radius;
    const pos = geometry.attributes.position;
    // Keep the flat positions so the material can blend back to a straight
    // title (uBend) when its panel is focused.
    geometry.setAttribute(
      "aFlat",
      new THREE.BufferAttribute(new Float32Array(pos.array), 3)
    );
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const phi = x / R;
      const r = R + z;
      pos.setXYZ(i, r * Math.sin(phi), y, r * Math.cos(phi) - R);
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  build() {
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      child.traverse((o) => o.geometry && o.geometry.dispose());
    }

    const segments = Math.max(3, Math.round(CYLINDER.segments));
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const { title } = PANELS[i % PANELS.length];
      const geometry = new TextGeometry(title, {
        font: this.font,
        size: TEXT.size,
        depth: TEXT.depth,
        curveSegments: 8,
        bevelEnabled: false,
      });
      geometry.computeBoundingBox();
      const bb = geometry.boundingBox;
      // Centre the text on its own origin, so it lands centred on the ring.
      geometry.translate(
        -(bb.max.x + bb.min.x) / 2,
        -(bb.max.y + bb.min.y) / 2,
        -(bb.max.z + bb.min.z) / 2
      );
      this.bendGeometry(geometry);

      const mesh = new THREE.Mesh(
        geometry,
        this.materials[i % this.materials.length]
      );
      // Push outward from the panel surface, along the wrapper's local z.
      mesh.position.z = CYLINDER.depth / 2 + TEXT.offset;

      // The wrapper matches the panel's own position/orientation exactly.
      const wrapper = new THREE.Group();
      wrapper.position.set(
        Math.cos(angle) * CYLINDER.radius,
        0,
        Math.sin(angle) * CYLINDER.radius
      );
      wrapper.rotation.y = Math.PI / 2 - angle;
      wrapper.add(mesh);
      wrapper.userData.index = i;
      wrapper.userData.basePos = wrapper.position.clone();
      this.group.add(wrapper);
    }
  }

  setDebug() {
    this.debug.whenReady((ui) => {
      const rebuild = () => this.build();
      const set = (key) => (value) => {
        for (const material of this.materials) material[key] = value;
      };
      const setColor = (key) => (c) => {
        for (const material of this.materials) {
          material[key].fromArray(c.map((v) => v / 255));
        }
      };

      const folder = ui.addFolder("Text");
      folder.add(TEXT, "size", 0.05, 0.6, 0.01).name("size").onChange(rebuild);
      folder.add(TEXT, "depth", 0.005, 0.2, 0.005).name("depth").onChange(rebuild);
      folder.add(TEXT, "offset", 0, 0.5, 0.01).name("offset").onChange(rebuild);
      folder
        .add(TEXT, "transmission", 0, 1, 0.01)
        .name("transmission")
        .onChange(set("transmission"));
      folder.add(TEXT, "roughness", 0, 1, 0.01).name("roughness").onChange(set("roughness"));
      folder.add(TEXT, "thickness", 0, 2, 0.01).name("thickness").onChange(set("thickness"));
      folder.add(TEXT, "ior", 1, 2.5, 0.01).name("ior").onChange(set("ior"));
      folder.addColor(TEXT, "color").name("tint").onChange(setColor("color"));

      folder.add(TEXT, "clearcoat", 0, 1, 0.01).name("clearcoat").onChange(set("clearcoat"));
      folder
        .add(TEXT, "clearcoatRoughness", 0, 1, 0.01)
        .name("coat roughness")
        .onChange(set("clearcoatRoughness"));
      folder
        .add(TEXT, "reflectivity", 0, 1, 0.01)
        .name("reflectivity")
        .onChange(set("reflectivity"));
      folder
        .add(TEXT, "specularIntensity", 0, 2, 0.01)
        .name("specular")
        .onChange(set("specularIntensity"));
      folder
        .add(TEXT, "envMapIntensity", 0, 3, 0.01)
        .name("env reflect")
        .onChange(set("envMapIntensity"));

      folder
        .addColor(TEXT, "attenuationColor")
        .name("tint (volume)")
        .onChange(setColor("attenuationColor"));
      folder
        .add(TEXT, "attenuationDistance", 0.05, 5, 0.05)
        .name("tint depth")
        .onChange(set("attenuationDistance"));

      folder.add(TEXT, "dispersion", 0, 5, 0.01).name("dispersion").onChange(set("dispersion"));
      folder
        .add(TEXT, "iridescence", 0, 1, 0.01)
        .name("iridescence")
        .onChange(set("iridescence"));
      folder
        .add(TEXT, "iridescenceIOR", 1, 2.5, 0.01)
        .name("iridescence ior")
        .onChange(set("iridescenceIOR"));
    });
  }

  destroy() {
    this.group.traverse((o) => o.geometry && o.geometry.dispose());
    for (const material of this.materials) material.dispose();
    this.group.removeFromParent();
  }
}
