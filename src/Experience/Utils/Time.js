import EventEmitter from "./EventEmitter.js";

// `elapsed` and `delta` are in seconds — every animation in the scene is tuned
// that way.
export default class Time extends EventEmitter {
  constructor() {
    super();
    this.start = performance.now();
    this.current = this.start;
    this.elapsed = 0;
    this.delta = 1 / 60;

    this.frame = window.requestAnimationFrame(() => this.tick());
  }

  tick() {
    const current = performance.now();
    this.delta = (current - this.current) / 1000;
    this.current = current;
    this.elapsed = (this.current - this.start) / 1000;

    this.trigger("tick");

    this.frame = window.requestAnimationFrame(() => this.tick());
  }

  destroy() {
    window.cancelAnimationFrame(this.frame);
  }
}
