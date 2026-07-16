import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import Experience from "../Experience.js";

// Only the physical (glass) titles sample this, giving the letters real
// reflection and refraction highlights. The panels and floor use custom shaders
// and are unaffected.
export default class Environment {
  constructor() {
    this.experience = new Experience();
    this.scene = this.experience.scene;

    this.pmrem = new THREE.PMREMGenerator(this.experience.renderer.instance);
    this.texture = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.texture;
  }

  destroy() {
    this.scene.environment = null;
    this.texture.dispose();
    this.pmrem.dispose();
  }
}
