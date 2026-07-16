import Experience from "../Experience.js";
import Environment from "./Environment.js";
import HeroText from "./HeroText.js";
import Cylinder from "./Cylinder.js";
import Floor from "./Floor.js";
import Titles from "./Titles.js";
import Focus from "./Focus.js";
import Intro from "./Intro.js";

export default class World {
  constructor() {
    this.experience = new Experience();
    // Published before anything else is built: the world's own classes reach
    // each other through the singleton (a title needs the ring's group, focus
    // needs both), and Experience only assigns this once the constructor ends.
    this.experience.world = this;
    this.resources = this.experience.resources;

    // The intro decides up front whether it will play, so the floor and hero
    // text can be built already hidden. Neither needs resources.
    this.intro = new Intro();
    this.heroText = new HeroText();

    // Wait for resources
    this.resources.on("ready", () => {
      // Setup
      this.environment = new Environment();
      this.cylinder = new Cylinder();
      this.floor = new Floor();
      this.titles = new Titles();
      this.focus = new Focus();
      this.intro.start();
    });
  }

  // Structural changes (segment count, radius, height…) rebuild the ring and
  // everything sized from it.
  rebuild() {
    this.cylinder.build();
    this.titles.build();
    this.floor.frame();
  }

  resize() {
    this.heroText.resize();
    this.cylinder?.resize();
  }

  update() {
    this.heroText.update();
    if (!this.cylinder) return;
    this.cylinder.update();
    this.focus.update();
    this.intro.update();
  }

  destroy() {
    this.resources.off("ready");
    this.heroText.destroy();
    this.focus?.destroy();
    this.titles?.destroy();
    this.floor?.destroy();
    this.cylinder?.destroy();
    this.environment?.destroy();
  }
}
