import * as THREE from "three";

import Debug from "./Utils/Debug.js";
import Sizes from "./Utils/Sizes.js";
import Time from "./Utils/Time.js";
import Pointer from "./Utils/Pointer.js";
import Resources from "./Utils/Resources.js";
import Camera from "./Camera.js";
import Renderer from "./Renderer.js";
import World from "./World/World.js";

import sources from "./sources.js";

let instance = null;

export default class Experience {
  constructor(_canvas) {
    // Singleton
    if (instance) {
      return instance;
    }
    instance = this;

    // Global access
    window.experience = this;

    // Options
    this.canvas = _canvas;

    // Router bridge — the scene is imperative and set up once, so the React
    // shell pushes the router and the current URL in (see setPath / Scene.jsx).
    this.router = null;
    this.pathname = window.location.pathname;

    // Setup
    this.debug = new Debug();
    this.sizes = new Sizes(_canvas);
    this.time = new Time();
    this.pointer = new Pointer();
    this.scene = new THREE.Scene();
    this.resources = new Resources(sources);
    this.camera = new Camera();
    this.renderer = new Renderer();
    this.world = new World();

    // Resize event
    this.sizes.on("resize", () => {
      this.resize();
    });

    // Time tick event
    this.time.on("tick", () => {
      this.update();
    });
  }

  // A slug focuses that panel; "/" reverses back to the ring.
  setPath(pathname) {
    this.pathname = pathname;
    this.world.focus?.onRoute(pathname);
  }

  resize() {
    this.camera.resize();
    this.renderer.resize();
    this.world.resize();
  }

  update() {
    this.pointer.update();
    this.world.update();
    this.camera.update();
    this.renderer.update();
  }

  destroy() {
    this.sizes.off("resize");
    this.time.off("tick");

    this.sizes.destroy();
    this.time.destroy();
    this.pointer.destroy();
    this.world.destroy();
    this.resources.destroy();
    this.renderer.instance.dispose();
    this.debug.destroy();

    window.experience = null;
    instance = null;
  }
}
