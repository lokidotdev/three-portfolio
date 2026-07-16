import EventEmitter from "./EventEmitter.js";

// The panel is a fixed 300px of tuning controls with no responsive layout of
// its own, so it's skipped on viewports it would cover rather than sit beside.
export default class Debug extends EventEmitter {
  constructor() {
    super();

    this.active = window.matchMedia("(min-width: 768px)").matches;
    if (!this.active) return;

    // dat.gui touches `window` at import time, so it can't be imported at
    // module scope (this module is pulled in during SSR).
    import("dat.gui").then(({ GUI }) => {
      if (this.destroyed) return;
      this.ui = new GUI({ width: 300 });
      this.trigger("ready");
    });
  }

  // Runs `callback(ui)` once the panel exists, whether it loads before or after
  // the caller is constructed.
  whenReady(callback) {
    if (!this.active) return;
    if (this.ui) callback(this.ui);
    else this.on("ready", () => callback(this.ui));
  }

  destroy() {
    this.destroyed = true;
    if (this.ui) this.ui.destroy();
  }
}
