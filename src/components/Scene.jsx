"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";

const FONT_URL = "/fonts/helvetiker_regular.typeface.json";

const Scene = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // --- Scene & Camera ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101014);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 6);

    // --- Lights ---
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    // --- Text mesh (added once font loads) ---
    let textMesh = null;
    const material = new THREE.MeshStandardMaterial({
      color: 0x4f9dff,
      metalness: 0.3,
      roughness: 0.4,
    });


    new FontLoader().load(FONT_URL, (font) => {
      const geometry = new TextGeometry("Portfolio", {
        font,
        size: 1,
        depth: 0.3,
        curveSegments: 8,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.02,
        bevelSegments: 3,
      });
      geometry.center();

      textMesh = new THREE.Mesh(geometry, material);
      scene.add(textMesh);
    });

    // --- Resize handling ---
    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    // --- Animation loop ---
    let frameId;
    const start = performance.now();
    const animate = () => {
      frameId = requestAnimationFrame(animate);

      renderer.render(scene, camera);
    };
    animate();

    // --- Cleanup ---
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      material.dispose();
      if (textMesh) textMesh.geometry.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100vw", height: "100vh", display: "block" }}
    />
  );
};

export default Scene;
