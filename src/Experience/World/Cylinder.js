import * as THREE from "three";
import Experience from "../Experience.js";

import { CYLINDER, PANELS } from "../sceneConfig.js";
import { makePanelMaterial } from "./Materials.js";

// Route segment for a panel's title ("Friends of the Future" ->
// "friends-of-the-future"), so a clicked panel and its URL stay in sync.
const titleToSlug = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// A ring of textured panels forming an open-top cylinder. The ring is turned by
// dragging instead of auto-rotating; on release it coasts, then eases to the
// nearest snap angle so exactly one panel faces the camera head-on.
export default class Cylinder {
  constructor() {
    this.experience = new Experience();
    this.scene = this.experience.scene;
    this.sizes = this.experience.sizes;
    this.pointer = this.experience.pointer;
    this.resources = this.experience.resources;
    this.debug = this.experience.debug;

    // `root` carries the tilt; `group` (the panels) spins inside it. The floor
    // is parented to root too, so it tilts with the cylinder base.
    this.root = new THREE.Group();
    this.root.rotation.x = CYLINDER.tilt;
    this.scene.add(this.root);

    this.group = new THREE.Group();
    this.root.add(this.group);

    this.materials = PANELS.map((panel) =>
      makePanelMaterial(this.resources.items[panel.name])
    );
    this.angVel = 0;

    this.setEvents();
    this.resize();
    this.build();
    this.setDebug();
  }

  // The panels only. Titles and shard groups also live under `group`, but as
  // Groups rather than meshes.
  get meshes() {
    return this.group.children.filter((child) => child.isMesh);
  }

  get segments() {
    return Math.max(3, Math.round(CYLINDER.segments));
  }

  // Angle between adjacent panels.
  get snapStep() {
    return (Math.PI * 2) / this.segments;
  }

  // Dragging is blocked while a panel is focused, so the ring stays put around it.
  get locked() {
    return Boolean(this.experience.world.focus?.active);
  }

  setEvents() {
    this.pointer.on("press", () => {
      if (!this.locked) this.angVel = 0;
    });
    this.pointer.on("drag", (dx) => {
      if (this.locked) return;
      const step = dx * CYLINDER.dragSensitivity * this.dragScale;
      this.group.rotation.y += step;
      this.angVel = step;
    });
  }

  build() {
    for (const mesh of this.meshes) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
    }

    for (const material of this.materials) {
      material.uniforms.uRadius.value = CYLINDER.radius;
    }

    // Arc length of one segment: the box is bent to this arc in the shader, so
    // its width must be the arc length for neighbours to meet on the ring.
    const arc =
      ((2 * Math.PI * CYLINDER.radius) / this.segments) * (1 - CYLINDER.gap);
    // Subdivide across the width so the shader bend reads as a smooth curve.
    const widthSegments = Math.max(2, Math.ceil(64 / this.segments));

    for (let i = 0; i < this.segments; i++) {
      const angle = (i / this.segments) * Math.PI * 2;
      const geometry = new THREE.BoxGeometry(
        arc,
        CYLINDER.height,
        CYLINDER.depth,
        widthSegments,
        1,
        1
      );
      const mesh = new THREE.Mesh(
        geometry,
        this.materials[i % this.materials.length]
      );
      mesh.position.set(
        Math.cos(angle) * CYLINDER.radius,
        0,
        Math.sin(angle) * CYLINDER.radius
      );
      // Tangent to the ring, facing outward.
      mesh.rotation.y = Math.PI / 2 - angle;
      mesh.userData.slug = titleToSlug(PANELS[i % PANELS.length].title);
      // Stable ring index + pristine base position, matched to the title's, so
      // focus pairing and restore don't depend on child order.
      mesh.userData.index = i;
      mesh.userData.basePos = mesh.position.clone();
      this.group.add(mesh);
    }
  }

  setDebug() {
    this.debug.whenReady((ui) => {
      const rebuild = () => this.experience.world.rebuild();
      const folder = ui.addFolder("Cylinder");
      folder.add(CYLINDER, "segments", 3, 40, 1).name("segments").onChange(rebuild);
      folder.add(CYLINDER, "radius", 0.5, 5, 0.05).name("radius").onChange(rebuild);
      folder.add(CYLINDER, "height", 0.2, 6, 0.05).name("height").onChange(rebuild);
      folder.add(CYLINDER, "gap", 0, 0.5, 0.01).name("gap").onChange(rebuild);
      folder.add(CYLINDER, "depth", 0.02, 0.6, 0.01).name("depth").onChange(rebuild);
      folder
        .add(CYLINDER, "tilt", -1, 1, 0.01)
        .name("tilt")
        .onChange((v) => (this.root.rotation.x = v));
      folder.add(CYLINDER, "dragSensitivity", 0.001, 0.02, 0.001).name("drag speed");
      folder.add(CYLINDER, "snapEase", 0.02, 0.5, 0.01).name("recenter speed");
      folder.add(CYLINDER, "coastDecay", 0.5, 0.98, 0.01).name("coast decay");
      folder.add(CYLINDER, "parallax", 0, 2, 0.01).name("parallax");
      folder.add(CYLINDER, "parallaxEase", 0.01, 0.3, 0.005).name("parallax ease");
      folder
        .addColor(CYLINDER, "planeColor")
        .name("card color")
        .onChange((c) => {
          for (const material of this.materials) {
            material.uniforms.uCardColor.value.fromArray(c.map((v) => v / 255));
          }
        });
    });
  }

  // Drag is measured in pixels, so on a narrow viewport a full swipe would turn
  // the ring by only a fraction of a panel. Scaled by viewport width so a swipe
  // covers about the same arc at any size — but only scaled up, so a wide
  // desktop keeps the tuned pixel sensitivity.
  resize() {
    this.dragScale = Math.max(1, CYLINDER.dragRefWidth / this.sizes.width);
  }

  update() {
    if (this.locked || this.pointer.drag.active) return;

    // Coast with the inertia carried out of the drag, decaying each frame.
    this.group.rotation.y += this.angVel;
    this.angVel *= CYLINDER.coastDecay;

    // Once nearly stopped, snap toward the closest facing angle.
    if (Math.abs(this.angVel) < 0.0005) {
      this.angVel = 0;
      const target =
        Math.round(this.group.rotation.y / this.snapStep) * this.snapStep;
      this.group.rotation.y +=
        (target - this.group.rotation.y) * CYLINDER.snapEase;
    }
  }

  destroy() {
    this.pointer.off("press");
    this.pointer.off("drag");
    for (const mesh of this.meshes) mesh.geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.scene.remove(this.root);
  }
}
