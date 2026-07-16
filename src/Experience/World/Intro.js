import Experience from "../Experience.js";

import { INTRO } from "../sceneConfig.js";

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smoothstep = (x) => x * x * (3 - 2 * x);
const easeInOutCubic = (x) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

// One-time load sequence: the camera swoops from a top-down view of the ring
// into the resting eye-level view. Once that swoop is `revealAt` complete, the
// reflective floor eases up + fades in and the hero text staggers into view.
//
// Constructed before the rest of the world (and before resources land) so the
// floor and hero text can be built already hidden; start() runs it.
export default class Intro {
  constructor() {
    this.experience = new Experience();
    // Skipped on a direct panel load — that starts focused, with no ring to
    // swoop onto.
    this.active = this.experience.pathname.replace(/^\/+/, "") === "";
    this.started = false;
    this.elapsed = 0;

    this.revealStart = INTRO.duration * INTRO.revealAt;
    this.duration = Math.max(
      INTRO.duration,
      this.revealStart + INTRO.floorDuration,
      this.revealStart + INTRO.textDuration
    );
  }

  start() {
    if (!this.active) return;
    this.started = true;
    this.experience.camera.introProgress = 0;
  }

  update() {
    if (!this.started) return;
    const { camera, world, time } = this.experience;

    this.elapsed += time.delta;
    camera.introProgress = easeInOutCubic(clamp01(this.elapsed / INTRO.duration));
    world.floor.setIntro(
      smoothstep(clamp01((this.elapsed - this.revealStart) / INTRO.floorDuration))
    );
    world.heroText.setIntro(
      clamp01((this.elapsed - this.revealStart) / INTRO.textDuration)
    );

    if (this.elapsed >= this.duration) {
      this.started = false;
      this.active = false;
      camera.introProgress = null;
      world.floor.setIntro(1);
      world.heroText.setIntro(1);
    }
  }
}
