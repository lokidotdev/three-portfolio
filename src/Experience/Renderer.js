import * as THREE from "three";
import Experience from "./Experience.js";

export default class Renderer {
  constructor() {
    this.experience = new Experience();
    this.canvas = this.experience.canvas;
    this.sizes = this.experience.sizes;
    this.scene = this.experience.scene;
    this.camera = this.experience.camera;

    this.setInstance();
  }

  setInstance() {
    this.instance = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.instance.outputColorSpace = THREE.SRGBColorSpace;
    this.instance.setClearColor(0xffffff, 1); // white base for the reflector pass
    // Two passes share the canvas, so clearing is done by hand in update().
    this.instance.autoClear = false;
    this.resize();
  }

  resize() {
    this.instance.setPixelRatio(this.sizes.pixelRatio);
    this.instance.setSize(this.sizes.width, this.sizes.height, false);
  }

  // Pass 1 is the flat hero-text effect, which clears the frame. Pass 2 draws
  // the perspective cylinder on top with a fresh depth buffer.
  update() {
    const { heroText } = this.experience.world;

    this.instance.clear();
    this.instance.render(heroText.scene, heroText.camera);

    this.instance.clearDepth();
    this.instance.render(this.scene, this.camera.instance);
  }
}
