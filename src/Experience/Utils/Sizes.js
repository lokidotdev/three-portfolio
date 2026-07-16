import EventEmitter from "./EventEmitter.js";

// Driven by a ResizeObserver on the canvas rather than window "resize", so it
// also fires for mobile browser-chrome changes (which move 100dvh) and
// orientation changes without a separate listener.
export default class Sizes extends EventEmitter {
  constructor(canvas) {
    super();
    this.canvas = canvas;
    this.measure();

    this.observer = new ResizeObserver(() => {
      const { width, height } = this;
      this.measure();
      if (this.width !== width || this.height !== height) this.trigger("resize");
    });
    this.observer.observe(canvas);
  }

  measure() {
    this.width = this.canvas.clientWidth || window.innerWidth;
    this.height = this.canvas.clientHeight || window.innerHeight;
    this.aspect = this.width / this.height;
    this.pixelRatio = Math.min(window.devicePixelRatio, 2);
  }

  destroy() {
    this.observer.disconnect();
  }
}
