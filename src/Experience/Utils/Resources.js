import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import EventEmitter from "./EventEmitter.js";

export default class Resources extends EventEmitter {
  constructor(sources) {
    super();

    this.sources = sources;

    this.items = {};
    this.toLoad = this.sources.length;
    this.loaded = 0;

    this.setLoaders();
    this.startLoading();
  }

  setLoaders() {
    this.loaders = {};
    this.loaders.textureLoader = new THREE.TextureLoader();
    this.loaders.fontLoader = new FontLoader();
  }

  startLoading() {
    for (const source of this.sources) {
      if (source.type === "texture") {
        this.loaders.textureLoader.load(source.path, (file) => {
          file.colorSpace = THREE.SRGBColorSpace;
          file.minFilter = THREE.LinearFilter;
          file.magFilter = THREE.LinearFilter;
          this.sourceLoaded(source, file);
        });
      } else if (source.type === "font") {
        this.loaders.fontLoader.load(source.path, (file) => {
          this.sourceLoaded(source, file);
        });
      }
    }
  }

  sourceLoaded(source, file) {
    this.items[source.name] = file;

    this.loaded++;

    if (this.loaded === this.toLoad) {
      this.trigger("ready");
    }
  }

  destroy() {
    for (const item of Object.values(this.items)) {
      if (typeof item.dispose === "function") item.dispose();
    }
  }
}
