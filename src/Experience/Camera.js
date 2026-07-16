import * as THREE from "three";
import Experience from "./Experience.js";
import { CYLINDER, INTRO } from "./sceneConfig.js";

export default class Camera {
  constructor() {
    this.experience = new Experience();
    this.sizes = this.experience.sizes;
    this.scene = this.experience.scene;
    this.pointer = this.experience.pointer;

    // Resting placement, before the responsive dolly (see resize).
    this.rest = new THREE.Vector3(0, CYLINDER.camY, CYLINDER.camZ);
    this.base = this.rest.clone();
    this.parallaxOffset = new THREE.Vector2(0, 0);
    // Top-down start of the intro swoop, scaled with the dolly so it stays the
    // same move relative to the resting view. Blended toward the resting view
    // while `introProgress` is set (see World/Intro.js).
    this.introStart = new THREE.Vector3(0, INTRO.startY, INTRO.startZ);
    this.introProgress = null;

    this.setInstance();
    this.resize();
  }

  setInstance() {
    this.instance = new THREE.PerspectiveCamera(50, this.sizes.aspect, 0.1, 100);
    this.instance.position.copy(this.base);
    this.instance.lookAt(0, 0, 0);
    this.scene.add(this.instance);
  }

  // Keep the ring framed on any viewport shape: the 50° fov is vertical, so a
  // narrow viewport sees less horizontally and would crop the ring. Scaling the
  // whole resting position dollies the camera along its view ray, so the
  // composition is unchanged and only the ring's on-screen size shrinks.
  resize() {
    this.dolly = THREE.MathUtils.clamp(
      CYLINDER.frameAspect / this.sizes.aspect,
      1,
      CYLINDER.maxDolly
    );
    this.base.copy(this.rest).multiplyScalar(this.dolly);
    this.introStart.set(0, INTRO.startY, INTRO.startZ).multiplyScalar(this.dolly);
    this.instance.aspect = this.sizes.aspect;
    this.instance.updateProjectionMatrix();
  }

  // Drift opposite-of-center with the mouse and keep aiming at the ring, so the
  // cylinder shifts against the flat hero text behind it.
  update() {
    const mouse = this.pointer.current;
    this.parallaxOffset.x +=
      ((mouse.x - 0.5) * 2 * CYLINDER.parallax - this.parallaxOffset.x) *
      CYLINDER.parallaxEase;
    this.parallaxOffset.y +=
      ((mouse.y - 0.5) * 2 * CYLINDER.parallax - this.parallaxOffset.y) *
      CYLINDER.parallaxEase;

    const targetX = this.base.x + this.parallaxOffset.x;
    const targetY = this.base.y + this.parallaxOffset.y;

    if (this.introProgress !== null) {
      const e = this.introProgress;
      this.instance.position.set(
        this.introStart.x + (targetX - this.introStart.x) * e,
        this.introStart.y + (targetY - this.introStart.y) * e,
        this.introStart.z + (this.base.z - this.introStart.z) * e
      );
    } else {
      this.instance.position.set(targetX, targetY, this.base.z);
    }
    this.instance.lookAt(0, 0, 0);
  }
}
