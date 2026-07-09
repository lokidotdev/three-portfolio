"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

import { CONFIG, CYLINDER } from "@/config/sceneConfig";
import { createTextEffect } from "@/components/textEffect";
import { createCylinder } from "@/components/cylinder";
import { createGui } from "@/components/createGui";

const Scene = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xffffff, 1); // white base for the reflector pass
    renderer.outputColorSpace  = THREE.SRGBColorSpace

    // --- Pass 1: flat, full-screen text distortion effect ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const { material, mesh: quad, texture } = createTextEffect();
    scene.add(quad);

    // --- Pass 2: perspective cylinder drawn in front ---
    const cyl = createCylinder(renderer);
    // Eased parallax offset applied to the camera each frame (driven by mouse).
    const parallaxOffset = new THREE.Vector2(0, 0);

    // --- Cylinder drag/snap state ---
    // The ring is turned by dragging (mouse or touch) instead of auto-rotating.
    // When released, it eases to the nearest "snap" angle so exactly one panel
    // faces the camera head-on.
    const seg = Math.max(3, Math.round(CYLINDER.segments));
    const snapStep = (Math.PI * 2) / seg; // angle between adjacent panels
    const dragState = {
      active: false,
      pointerId: null,
      lastX: 0,
      // Angular velocity (rad/sec) carried from the drag for a little inertia.
      angVel: 0,
    };

    const onCylPointerDown = (e) => {
      dragState.active = true;
      dragState.pointerId = e.pointerId;
      dragState.lastX = e.clientX;
      dragState.angVel = 0;
      canvas.setPointerCapture?.(e.pointerId);
    };
    const onCylPointerMove = (e) => {
      if (!dragState.active || e.pointerId !== dragState.pointerId) return;
      const dx = e.clientX - dragState.lastX;
      dragState.lastX = e.clientX;
      cyl.cylGroup.rotation.y += dx * CYLINDER.dragSensitivity;
      dragState.angVel = dx * CYLINDER.dragSensitivity;
    };
    const onCylPointerUp = (e) => {
      if (e.pointerId !== dragState.pointerId) return;
      dragState.active = false;
      dragState.pointerId = null;
      canvas.releasePointerCapture?.(e.pointerId);
    };
    canvas.addEventListener("pointerdown", onCylPointerDown);
    canvas.addEventListener("pointermove", onCylPointerMove);
    canvas.addEventListener("pointerup", onCylPointerUp);
    canvas.addEventListener("pointercancel", onCylPointerUp);

    // --- Pointer handling ---
    // Targets are eased toward each frame for a smooth, liquid response.
    const mouse = new THREE.Vector2(0.5, 0.5);
    const targetMouse = new THREE.Vector2(0.5, 0.5);
    // The effect is driven by how fast the pointer is moving: each move adds
    // "velocity" that decays every frame, so a stationary cursor fades to zero.
    let velocity = 0;
    let hasMoved = false;
    // Smoothed direction the pointer is travelling in (used to orient the smear).
    const moveDir = new THREE.Vector2(1, 0);
    const targetMoveDir = new THREE.Vector2(1, 0);
    // Mutable motion params the GUI can tweak live.
    const motion = {
      velocityGain: CONFIG.velocityGain,
      velocityDecay: CONFIG.velocityDecay,
      mouseEase: CONFIG.mouseEase,
      responseSpeed: CONFIG.responseSpeed,
    };

    const onPointerMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = 1 - (e.clientY - rect.top) / rect.height;
      if (hasMoved) {
        const dx = nx - targetMouse.x;
        const dy = ny - targetMouse.y;
        const len = Math.hypot(dx, dy);
        velocity = Math.min(1, velocity + len * motion.velocityGain);
        // Record the travel direction (aspect-weighted so it matches the screen).
        if (len > 1e-5) {
          const aspect = material.uniforms.uScreenAspect.value;
          targetMoveDir.set(dx * aspect, dy).normalize();
        }
      }
      targetMouse.set(nx, ny);
      hasMoved = true;
    };
    const onPointerLeave = () => {
      velocity = 0;
    };
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);

    // --- Resize handling ---
    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      renderer.setSize(width, height, false);
      material.uniforms.uScreenAspect.value = width / height;
      cyl.cylCamera.aspect = width / height;
      cyl.cylCamera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    // --- Animation loop ---
    // Two passes share the canvas: the flat text effect clears the frame, then
    // the perspective cylinder is drawn on top with a fresh depth buffer.
    renderer.autoClear = false;
    let frameId;
    const start = performance.now();
    let lastT = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = (performance.now() - start) / 1000;
      const dt = t - lastT;
      lastT = t;

      mouse.lerp(targetMouse, motion.mouseEase);
      material.uniforms.uMouse.value.copy(mouse);

      // Ease the smear direction toward the latest travel direction.
      moveDir.lerp(targetMoveDir, 0.2);
      material.uniforms.uMoveDir.value.copy(moveDir).normalize();

      // Decay velocity so the distortion only lives while the pointer moves.
      velocity *= motion.velocityDecay;
      material.uniforms.uHover.value +=
        (velocity - material.uniforms.uHover.value) * motion.responseSpeed;
      material.uniforms.uTime.value = t;

      // Pass 1: full-screen text effect (clears colour + depth).
      renderer.clear();
      renderer.render(scene, camera);

      // Pass 2: cylinder in front, on a cleared depth buffer.
      // Turned by dragging; when released it coasts on leftover velocity, then
      // eases to the nearest snap angle so one panel faces the camera head-on.
      const ring = cyl.cylGroup;
      if (dragState.active) {
        // Rotation is driven directly by the pointer in the move handler.
      } else {
        // Coast with the inertia carried out of the drag, decaying each frame.
        ring.rotation.y += dragState.angVel;
        dragState.angVel *= CYLINDER.coastDecay;
        // Once nearly stopped, snap toward the closest facing angle.
        if (Math.abs(dragState.angVel) < 0.0005) {
          dragState.angVel = 0;
          const target = Math.round(ring.rotation.y / snapStep) * snapStep;
          ring.rotation.y += (target - ring.rotation.y) * CYLINDER.snapEase;
        }
      }
      // Parallax: drift the camera opposite-of-center with the mouse (mouse is
      // 0..1, remapped to -1..1) and keep it aimed at the ring, so the cylinder
      // shifts against the flat text layer behind it.
      const { camBase, cylCamera } = cyl;
      parallaxOffset.x +=
        ((mouse.x - 0.5) * 2 * CYLINDER.parallax - parallaxOffset.x) *
        CYLINDER.parallaxEase;
      parallaxOffset.y +=
        ((mouse.y - 0.5) * 2 * CYLINDER.parallax - parallaxOffset.y) *
        CYLINDER.parallaxEase;
      cylCamera.position.set(
        camBase.x + parallaxOffset.x,
        camBase.y + parallaxOffset.y,
        camBase.z
      );
      cylCamera.lookAt(0, 0, 0);
      renderer.clearDepth();
      renderer.render(cyl.cylScene, cylCamera);
    };
    animate();

    // --- dat.GUI controls ---
    // dat.gui touches `window` at import time, so load it client-side only.
    let gui = null;
    let disposed = false;
    import("dat.gui").then(({ GUI }) => {
      if (disposed) return;
      gui = createGui({
        GUI,
        uniforms: material.uniforms,
        motion,
        planeMats: cyl.planeMats,
        textMats: cyl.textMats,
        cylRoot: cyl.cylRoot,
        floor: cyl.floor,
        buildCylinder: cyl.buildCylinder,
        buildText: cyl.buildText,
      });
    });

    // --- Cleanup ---
    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointerdown", onCylPointerDown);
      canvas.removeEventListener("pointermove", onCylPointerMove);
      canvas.removeEventListener("pointerup", onCylPointerUp);
      canvas.removeEventListener("pointercancel", onCylPointerUp);
      if (gui) gui.destroy();
      quad.geometry.dispose();
      material.dispose();
      texture.dispose();
      cyl.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100vw",
        height: "100vh",
        display: "block",
        touchAction: "none",
        cursor: "grab",
      }}
    />
  );
};

export default Scene;
