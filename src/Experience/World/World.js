import Experience from "../Experience.js";
import Environment from "./Environment.js";
import HeroText from "./HeroText.js";
import Cylinder from "./Cylinder.js";
import Floor from "./Floor.js";
import Titles from "./Titles.js";
import Focus from "./Focus.js";
import Intro from "./Intro.js";
import ScrollContent from "./ScrollContent.js";
import { SCROLL } from "../sceneConfig.js";

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
    this.scrollContent = new ScrollContent();

    // The page's scroll position (in viewport heights) and the eased value the
    // scene actually animates on — see setScroll / update.
    this.scrollTarget = 0;
    this.scroll = 0;

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

  // The content plane is drawn at its panel's aspect rather than the viewport's,
  // so unlike the hero text it has nothing to redraw on resize.
  resize() {
    this.heroText.resize();
    this.cylinder?.resize();
  }

  update() {
    // The wheel arrives in coarse jumps, so the scene chases the page's scroll
    // instead of tracking it exactly: every scroll-driven animation reads the
    // eased value and so glides between wheel notches.
    this.scroll += (this.scrollTarget - this.scroll) * SCROLL.ease;
    this.applyScroll(this.scroll);

    this.heroText.update();
    if (!this.cylinder) return;
    this.cylinder.update();
    this.focus.update();
    this.intro.update();
  }

  // vy is scroll position in viewport heights (0 at the top of a route). Eased
  // toward in update.
  setScroll(vy) {
    this.scrollTarget = vy;
  }

  // The first fadeDistance drifts the focused panel's title up and fades it out
  // with the shards; the content plane takes over below that (see ScrollContent).
  applyScroll(vy) {
    this.focus?.setScroll(Math.min(1, Math.max(0, vy / SCROLL.fadeDistance)));
    this.scrollContent.setScroll(vy);
  }

  destroy() {
    this.resources.off("ready");
    this.heroText.destroy();
    this.scrollContent.destroy();
    this.focus?.destroy();
    this.titles?.destroy();
    this.floor?.destroy();
    this.cylinder?.destroy();
    this.environment?.destroy();
  }
}
