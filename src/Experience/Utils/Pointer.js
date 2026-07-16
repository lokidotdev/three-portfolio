import * as THREE from "three";
import Experience from "../Experience.js";
import EventEmitter from "./EventEmitter.js";
import { CONFIG } from "../sceneConfig.js";

// All pointer state for the canvas: an eased position, a movement "velocity"
// that drives the hero-text distortion, and the ring's drag gesture.
// Emits: "press", "drag" [dx], "release", "click" [clientX, clientY].
export default class Pointer extends EventEmitter {
  constructor() {
    super();
    this.experience = new Experience();
    this.canvas = this.experience.canvas;
    this.sizes = this.experience.sizes;
    this.debug = this.experience.debug;

    // Canvas-normalized (0..1, y up). `current` eases toward `target` for a
    // smooth, liquid response.
    this.target = new THREE.Vector2(0.5, 0.5);
    this.current = new THREE.Vector2(0.5, 0.5);
    // Smoothed direction of travel, used to orient the smear.
    this.moveDir = new THREE.Vector2(1, 0);
    this.targetMoveDir = new THREE.Vector2(1, 0);
    // Each move adds velocity, which decays every frame — so a stationary
    // cursor fades to zero. `hover` is the smoothed version the shader reads.
    this.velocity = 0;
    this.hover = 0;
    this.hasMoved = false;
    this.motion = {
      velocityGain: CONFIG.velocityGain,
      velocityDecay: CONFIG.velocityDecay,
      mouseEase: CONFIG.mouseEase,
      responseSpeed: CONFIG.responseSpeed,
    };

    // A touch wobbles more than a mouse click, so it gets more slop before the
    // press is read as a drag rather than a panel selection.
    this.clickSlop = window.matchMedia("(pointer: coarse)").matches ? 12 : 6;
    this.drag = {
      active: false,
      pointerId: null,
      lastX: 0,
      downX: 0,
      downY: 0,
      moved: 0,
    };

    this.setEvents();
    this.setDebug();
  }

  setEvents() {
    this.onPointerMove = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width;
      const ny = 1 - (event.clientY - rect.top) / rect.height;

      if (this.hasMoved) {
        const dx = nx - this.target.x;
        const dy = ny - this.target.y;
        const length = Math.hypot(dx, dy);
        this.velocity = Math.min(
          1,
          this.velocity + length * this.motion.velocityGain
        );
        // Aspect-weighted, so the direction matches the one seen on screen.
        if (length > 1e-5) {
          this.targetMoveDir.set(dx * this.sizes.aspect, dy).normalize();
        }
      }
      this.target.set(nx, ny);
      this.hasMoved = true;

      if (this.drag.active && event.pointerId === this.drag.pointerId) {
        const dx = event.clientX - this.drag.lastX;
        this.drag.lastX = event.clientX;
        this.drag.moved = Math.max(
          this.drag.moved,
          Math.hypot(
            event.clientX - this.drag.downX,
            event.clientY - this.drag.downY
          )
        );
        this.trigger("drag", [dx]);
      }
    };

    this.onPointerLeave = () => {
      this.velocity = 0;
    };

    this.onPointerDown = (event) => {
      this.drag.active = true;
      this.drag.pointerId = event.pointerId;
      this.drag.lastX = event.clientX;
      this.drag.downX = event.clientX;
      this.drag.downY = event.clientY;
      this.drag.moved = 0;
      this.canvas.setPointerCapture?.(event.pointerId);
      this.trigger("press");
    };

    this.onPointerUp = (event) => {
      if (event.pointerId !== this.drag.pointerId) return;
      this.drag.active = false;
      this.drag.pointerId = null;
      this.canvas.releasePointerCapture?.(event.pointerId);
      this.trigger("release");
      // A near-stationary press is a click, not a drag.
      if (this.drag.moved < this.clickSlop) {
        this.trigger("click", [event.clientX, event.clientY]);
      }
    };

    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerleave", this.onPointerLeave);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
  }

  setDebug() {
    this.debug.whenReady((ui) => {
      const folder = ui.addFolder("Motion");
      folder.add(this.motion, "responseSpeed", 0.02, 1, 0.01).name("speed");
      folder.add(this.motion, "velocityGain", 0, 20, 0.1).name("sensitivity");
      folder.add(this.motion, "velocityDecay", 0.5, 0.99, 0.01).name("decay");
      folder.add(this.motion, "mouseEase", 0.02, 1, 0.01).name("follow ease");
    });
  }

  update() {
    this.current.lerp(this.target, this.motion.mouseEase);
    this.moveDir.lerp(this.targetMoveDir, 0.2);
    this.velocity *= this.motion.velocityDecay;
    this.hover += (this.velocity - this.hover) * this.motion.responseSpeed;
  }

  destroy() {
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
  }
}
