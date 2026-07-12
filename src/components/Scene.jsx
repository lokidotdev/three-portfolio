"use client";

import React, { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import * as THREE from "three";

import { CONFIG, CYLINDER, TEXT, INTRO } from "@/config/sceneConfig";
import { createTextEffect } from "@/components/textEffect";
import { createCylinder } from "@/components/cylinder";
import { createGui } from "@/components/createGui";

const Scene = () => {
  const canvasRef = useRef(null);
  const router = useRouter();
  const pathname = usePathname();
  // Bridges the React router into the imperative animation loop, which is set
  // up once and can't read fresh props/hooks directly.
  const routerRef = useRef(router);
  routerRef.current = router;
  // Populated by the animation effect with { onRoute } so route changes can
  // drive the focus animation forward/backward.
  const sceneCtrlRef = useRef(null);

  // Whenever the URL changes, tell the scene which panel (if any) should be
  // focused: a slug focuses that panel, "/" reverses back to the ring.
  useEffect(() => {
    sceneCtrlRef.current?.onRoute(pathname);
  }, [pathname]);

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
      // Down position, used to tell a click apart from a drag on pointer up.
      downX: 0,
      downY: 0,
      moved: 0,
    };

    // --- Panel selection / focus transition ---
    // Clicking a panel fades and removes every other panel (and all titles),
    // then flattens the chosen panel and eases it toward the camera. The
    // animation is fully reversible and driven by the route: focusing a panel
    // navigates to its slug; returning to "/" plays it backward.
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    // Non-null while a panel is focused or mid-transition; blocks dragging so
    // the ring stays put around the selected panel.
    // Shape: { selected, others, outward, basePos, p, dir }
    //   p   0 = ring, 1 = fully focused (eased each frame toward dir's target)
    //   dir "in" | "out"
    let focus = null;
    const FOCUS_DURATION = 0.7; // seconds — pull-in / flatten phase
    const TEXT_FLATTEN_DURATION = 0.5; // seconds — title glass -> flat black 2D
    const SHATTER_DURATION = 0.9; // seconds — break-apart / scatter phase
    const smoothstep = (x) => x * x * (3 - 2 * x);
    const clamp01 = (x) => Math.max(0, Math.min(1, x));
    const easeInOutCubic = (x) =>
      x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

    // Blend the focused title from clear glass (k = 0) to flat, matte black 2D
    // text (k = 1): drop the transmission/clearcoat glass response, darken to
    // black, and collapse the extrusion so it reads as flat 2D text. The
    // material is cloned per focus (see beginFocus), so this only touches the
    // selected title. Values are absolute in k, so it reverses cleanly.
    const applyTitleFlatten = (mesh, k) => {
      const m = mesh.material;
      m.transmission = TEXT.transmission * (1 - k);
      m.thickness = TEXT.thickness * (1 - k);
      m.clearcoat = TEXT.clearcoat * (1 - k);
      m.reflectivity = TEXT.reflectivity * (1 - k);
      m.specularIntensity = TEXT.specularIntensity * (1 - k);
      m.envMapIntensity = TEXT.envMapIntensity * (1 - k);
      m.roughness = TEXT.roughness + (1 - TEXT.roughness) * k;
      m.color.setScalar(1 - k); // white glass tint -> black
      mesh.scale.z = 1 - k * (1 - CYLINDER.textFlattenDepth);
    };

    const panelMeshes = () => cyl.cylGroup.children.filter((c) => c.isMesh);

    // Begin focusing `selected`, animating in. No-op if already focused.
    const beginFocus = (selected) => {
      if (focus) return;
      // Give the selected panel its own material so flattening it doesn't
      // affect the other panels that share this texture's material.
      selected.material = selected.material.clone();
      const basePos = selected.userData.basePos;
      // Outward direction in cylGroup space (panel faces this way).
      const outward = new THREE.Vector3(basePos.x, 0, basePos.z).normalize();
      // Pair the title to the panel by its stable ring index (not child order,
      // which changes as panels are removed/re-added), so the right title
      // straightens and moves forward in lockstep with the panel.
      const textWrapper =
        cyl.textGroup.children.find(
          (w) => w.userData.index === selected.userData.index
        ) || null;
      if (textWrapper) {
        const textMesh = textWrapper.children[0];
        // Own material so straightening/keeping-visible doesn't touch the
        // other titles (which share materials and get faded out).
        textMesh.material = textMesh.material.clone();
        textMesh.material.userData.uBend = { value: 1 };
      }
      // The non-selected panels fade out via alpha, so they need to blend —
      // but only for the duration of the focus. They're restored to opaque on
      // the way back so the glass titles refract them again in the ring state.
      const others = panelMeshes().filter((p) => p !== selected);
      for (const p of others) p.material.transparent = true;
      focus = {
        selected,
        others,
        outward,
        basePos,
        textWrapper,
        textBasePos: textWrapper ? textWrapper.userData.basePos : null,
        p: 0, // pull-in / flatten progress
        tx: 0, // title glass -> flat black 2D progress
        s: 0, // shatter / scatter progress
        shards: null,
        dir: "in",
      };
    };

    const selectPanelAt = (clientX, clientY) => {
      if (focus) return;
      const rect = canvas.getBoundingClientRect();
      ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, cyl.cylCamera);
      const hit = raycaster.intersectObjects(panelMeshes(), false)[0];
      if (!hit) return;
      // Start focusing; the URL is swapped to the panel's slug once the
      // animation finishes (see the loop), not on click.
      beginFocus(hit.object);
    };

    // Route -> focus state. A slug focuses the matching panel; "/" reverses.
    const onRoute = (path) => {
      const slug = (path || "/").replace(/^\/+/, "");
      if (!slug) {
        // Home: reverse any active focus back to the ring.
        if (focus) focus.dir = "out";
        return;
      }
      // A slug: focus the matching panel if it isn't already the target.
      if (focus && focus.selected.userData.slug === slug) {
        focus.dir = "in";
        return;
      }
      if (focus) return; // a different focus is in progress; ignore
      const target = panelMeshes().find((p) => p.userData.slug === slug);
      if (target) beginFocus(target);
    };
    sceneCtrlRef.current = { onRoute };
    // Honor the initial URL (e.g. a direct load / refresh on a panel route).
    onRoute(window.location.pathname);

    // Clip a convex polygon (array of [x,y]) to the half-plane of points on the
    // near side of a line through `a` with outward normal `n` (Sutherland-
    // Hodgman, single edge). Keeps points where dot(p - a, n) <= 0.
    const clipHalfPlane = (poly, ax, ay, nx, ny) => {
      const out = [];
      const side = (p) => (p[0] - ax) * nx + (p[1] - ay) * ny;
      for (let i = 0; i < poly.length; i++) {
        const cur = poly[i];
        const prev = poly[(i + poly.length - 1) % poly.length];
        const dCur = side(cur);
        const dPrev = side(prev);
        const curIn = dCur <= 0;
        const prevIn = dPrev <= 0;
        if (curIn !== prevIn) {
          const t = dPrev / (dPrev - dCur);
          out.push([
            prev[0] + t * (cur[0] - prev[0]),
            prev[1] + t * (cur[1] - prev[1]),
          ]);
        }
        if (curIn) out.push(cur);
      }
      return out;
    };

    // Break a focused panel into irregular Voronoi shards: each cell is the
    // panel rectangle clipped by the perpendicular bisector to every other
    // seed, so the fracture lines look like a real broken plate rather than a
    // grid. Shards share the panel's (now flat) material and reassemble it.
    const buildShards = (panel) => {
      const arc = panel.geometry.parameters.width;
      const h = panel.geometry.parameters.height;
      const hw = arc / 2;
      const hh = h / 2;
      const n = Math.max(3, Math.round(CYLINDER.shatterPieces));
      const seeds = [];
      for (let i = 0; i < n; i++) {
        seeds.push([(Math.random() - 0.5) * arc, (Math.random() - 0.5) * h]);
      }
      const group = new THREE.Group();
      // Match the panel's focused transform so shards start exactly on it.
      group.position.copy(panel.position);
      group.quaternion.copy(panel.quaternion);

      for (let i = 0; i < seeds.length; i++) {
        const [sx, sy] = seeds[i];
        // Start from the full panel rectangle, clip against each other seed.
        let poly = [
          [-hw, -hh],
          [hw, -hh],
          [hw, hh],
          [-hw, hh],
        ];
        for (let j = 0; j < seeds.length && poly.length >= 3; j++) {
          if (j === i) continue;
          const [ox, oy] = seeds[j];
          // Bisector: line through the midpoint, normal toward the other seed.
          poly = clipHalfPlane(
            poly,
            (sx + ox) / 2,
            (sy + oy) / 2,
            ox - sx,
            oy - sy
          );
        }
        if (poly.length < 3) continue;

        // Centroid → shard pivots (and scatters/tumbles) about its own centre.
        let cx = 0;
        let cy = 0;
        for (const p of poly) {
          cx += p[0];
          cy += p[1];
        }
        cx /= poly.length;
        cy /= poly.length;

        // Inset slightly toward the centroid so the seams read as cracks.
        const inset = 0.985;
        const positions = [];
        const uvs = [];
        const pt = (k) => {
          const x = cx + (poly[k][0] - cx) * inset;
          const y = cy + (poly[k][1] - cy) * inset;
          positions.push(x - cx, y - cy, 0);
          uvs.push((x + hw) / arc, (y + hh) / h);
        };
        // Triangle fan over the convex cell.
        for (let k = 1; k < poly.length - 1; k++) {
          pt(0);
          pt(k);
          pt(k + 1);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(positions, 3)
        );
        geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));

        const shard = new THREE.Mesh(geo, panel.material);
        const home = new THREE.Vector3(cx, cy, 0);
        shard.position.copy(home);
        shard.userData = {
          home,
          // Random scatter, capped per axis: spread across/up the panel and
          // pushed outward toward the camera (z stays positive).
          scatter: new THREE.Vector3(
            (Math.random() - 0.5) * 2 * CYLINDER.shatterX,
            (Math.random() - 0.5) * 2 * CYLINDER.shatterY,
            Math.random() * CYLINDER.shatterZ
          ),
          tumble: new THREE.Euler(
            (Math.random() - 0.5) * CYLINDER.shatterTumble,
            (Math.random() - 0.5) * CYLINDER.shatterTumble,
            (Math.random() - 0.5) * CYLINDER.shatterTumble
          ),
          // Depth-based parallax weight: shards flung further drift more.
          parallax: 0.4 + Math.random(),
        };
        group.add(shard);
      }
      cyl.cylGroup.add(group);
      return group;
    };

    const disposeShards = (group) => {
      if (!group) return;
      cyl.cylGroup.remove(group);
      for (const s of group.children) s.geometry.dispose();
    };

    const onCylPointerDown = (e) => {
      if (focus) return;
      dragState.active = true;
      dragState.pointerId = e.pointerId;
      dragState.lastX = e.clientX;
      dragState.angVel = 0;
      dragState.downX = e.clientX;
      dragState.downY = e.clientY;
      dragState.moved = 0;
      canvas.setPointerCapture?.(e.pointerId);
    };
    const onCylPointerMove = (e) => {
      if (!dragState.active || e.pointerId !== dragState.pointerId) return;
      const dx = e.clientX - dragState.lastX;
      dragState.lastX = e.clientX;
      dragState.moved = Math.max(
        dragState.moved,
        Math.hypot(e.clientX - dragState.downX, e.clientY - dragState.downY)
      );
      cyl.cylGroup.rotation.y += dx * CYLINDER.dragSensitivity;
      dragState.angVel = dx * CYLINDER.dragSensitivity;
    };
    const onCylPointerUp = (e) => {
      if (e.pointerId !== dragState.pointerId) return;
      dragState.active = false;
      dragState.pointerId = null;
      canvas.releasePointerCapture?.(e.pointerId);
      // A near-stationary press is a click: focus the panel under the pointer.
      if (dragState.moved < 6) selectPanelAt(e.clientX, e.clientY);
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

    // --- Intro / load sequence ---
    // Swoop the cylinder camera from a top-down view into the resting view;
    // once ~90% through, ease the reflective floor up + fade it in and stagger
    // the hero text into view. Skipped on a direct panel load (starts focused).
    const startedFocused =
      window.location.pathname.replace(/^\/+/, "") !== "";
    let introDone = startedFocused;
    let introT = 0;
    const introStart = new THREE.Vector3(0, INTRO.startY, INTRO.startZ);
    const floorRestY = cyl.floor.position.y;
    // Start the floor and hero text hidden (unless we skipped the intro).
    material.uniforms.uIntro.value = startedFocused ? 1 : 0;
    cyl.floor.material.uniforms.introOpacity.value = startedFocused ? 1 : 0;
    if (!startedFocused) cyl.floor.position.y = floorRestY - INTRO.floorRise;

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
      if (focus) {
        const goingIn = focus.dir === "in";
        const stepP = dt / FOCUS_DURATION;
        const stepTx = dt / TEXT_FLATTEN_DURATION;
        const stepS = dt / SHATTER_DURATION;
        // Three phases: p = pull-in/flatten (0..1), tx = title glass->flat black
        // (0..1), s = shatter/scatter (0..1). Forward runs p, then tx, then s
        // (s starts once tx passes 0.5); reverse unwinds them in reverse order:
        // reassemble (s), un-flatten the title (tx), then un-pull the panel (p).
        if (goingIn) {
          focus.p = Math.min(1, focus.p + stepP);
        } else if (focus.s > 0) {
          focus.s = Math.max(0, focus.s - stepS);
        } else if (focus.tx > 0) {
          focus.tx = Math.max(0, focus.tx - stepTx);
        } else {
          focus.p = Math.max(0, focus.p - stepP);
        }
        const e = smoothstep(focus.p);

        // As the panel straightens (p 0->1), stagger the background hero text up
        // and out of view; reverse it back in on the way home. Same effect and
        // stagger as the load-in, but moving up.
        material.uniforms.uExit.value = e;

        // Reversing out: make sure removed panels are back in the ring to fade in.
        if (!goingIn && focus.detached && focus.s <= 0) {
          for (const p of focus.others) ring.add(p);
          focus.detached = false;
        }

        // Fade the other panels and the other titles with progress. The
        // selected title uses its own cloned material, so the shared textMats
        // only fade the non-selected titles.
        for (const p of focus.others) p.material.uniforms.uOpacity.value = 1 - e;
        for (const m of cyl.textMats) m.opacity = 1 - e;

        // Straighten the chosen panel and ease it toward the camera.
        focus.selected.material.uniforms.uBend.value = 1 - e;
        focus.selected.position
          .copy(focus.basePos)
          .addScaledVector(focus.outward, e * CYLINDER.focusPull);

        // The title follows: straighten it and move it forward the same amount,
        // keeping it opaque so it reads as the focused panel's label. Once
        // focused it pushes further out and flattens to black before the break.
        if (focus.textWrapper) {
          const textMesh = focus.textWrapper.children[0];
          textMesh.material.opacity = 1;
          textMesh.material.userData.uBend.value = 1 - e;
          // Once the panel is focused, the title eases further toward the camera
          // and drifts up while turning into flat black 2D text (tx phase).
          const txe = smoothstep(focus.tx);
          focus.textWrapper.position
            .copy(focus.textBasePos)
            .addScaledVector(
              focus.outward,
              e * CYLINDER.focusPull + txe * CYLINDER.textFlattenForward
            );
          focus.textWrapper.position.y += txe * CYLINDER.textFlattenUp;
          applyTitleFlatten(textMesh, txe);
        }

        if (goingIn && focus.p >= 1) {
          // Fully focused: detach the faded panels and swap the URL to the slug.
          if (!focus.detached) {
            for (const p of focus.others) ring.remove(p);
            focus.detached = true;
          }
          if (!focus.navigated) {
            focus.navigated = true;
            routerRef.current.push(`/${focus.selected.userData.slug}`, {
              scroll: false,
            });
          }
          // Push the title forward and turn it into flat black 2D text first.
          focus.tx = Math.min(1, focus.tx + stepTx);
          // Only once that transition is half done does the panel break apart.
          if (focus.tx >= 0.5) {
            if (!focus.shards) {
              focus.shards = buildShards(focus.selected);
              focus.selected.visible = false;
            }
            focus.s = Math.min(1, focus.s + stepS);
          }
        }

        // Drive the shards: blend home <-> scattered, tumble, and drift with a
        // mouse parallax that grows as they scatter.
        if (focus.shards) {
          const se = smoothstep(focus.s);
          const px = (mouse.x - 0.5) * 2 * CYLINDER.shatterParallax;
          const py = (mouse.y - 0.5) * 2 * CYLINDER.shatterParallax;
          for (const shard of focus.shards.children) {
            const ud = shard.userData;
            shard.position.copy(ud.home).addScaledVector(ud.scatter, se);
            shard.position.x += px * ud.parallax * se;
            shard.position.y += py * ud.parallax * se;
            shard.rotation.set(
              ud.tumble.x * se,
              ud.tumble.y * se,
              ud.tumble.z * se
            );
          }
          // Reassembled during reverse: drop the shards, show the solid panel.
          if (!goingIn && focus.s <= 0) {
            disposeShards(focus.shards);
            focus.shards = null;
            focus.selected.visible = true;
          }
        }

        if (!goingIn && focus.p <= 0 && !focus.shards) {
          // Fully back to the ring: restore state and release the focus lock.
          focus.selected.material.uniforms.uBend.value = 1;
          focus.selected.position.copy(focus.basePos);
          focus.selected.visible = true;
          // Return the faded panels to opaque so the titles refract them again.
          for (const p of focus.others) {
            p.material.uniforms.uOpacity.value = 1;
            p.material.transparent = false;
          }
          if (focus.textWrapper) {
            focus.textWrapper.children[0].material.userData.uBend.value = 1;
            focus.textWrapper.position.copy(focus.textBasePos);
          }
          focus = null;
        }
      } else if (dragState.active) {
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
      // Intro: advance the load sequence and get the camera swoop ease. The
      // floor eases up + fades in and the hero text staggers in, both starting
      // once the swoop is `revealAt` complete.
      let introEase = null;
      if (!introDone) {
        introT += dt;
        introEase = easeInOutCubic(clamp01(introT / INTRO.duration));
        const revealStart = INTRO.duration * INTRO.revealAt;
        const floorE = smoothstep(
          clamp01((introT - revealStart) / INTRO.floorDuration)
        );
        cyl.floor.material.uniforms.introOpacity.value = floorE;
        cyl.floor.position.y = floorRestY - INTRO.floorRise * (1 - floorE);
        material.uniforms.uIntro.value = clamp01(
          (introT - revealStart) / INTRO.textDuration
        );
        const totalT = Math.max(
          INTRO.duration,
          revealStart + INTRO.floorDuration,
          revealStart + INTRO.textDuration
        );
        if (introT >= totalT) {
          introDone = true;
          introEase = null;
          cyl.floor.position.y = floorRestY;
          cyl.floor.material.uniforms.introOpacity.value = 1;
          material.uniforms.uIntro.value = 1;
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
      const targetX = camBase.x + parallaxOffset.x;
      const targetY = camBase.y + parallaxOffset.y;
      if (introEase !== null) {
        // Swoop from the top-down start into the resting (parallaxed) view.
        cylCamera.position.set(
          introStart.x + (targetX - introStart.x) * introEase,
          introStart.y + (targetY - introStart.y) * introEase,
          introStart.z + (camBase.z - introStart.z) * introEase
        );
      } else {
        cylCamera.position.set(targetX, targetY, camBase.z);
      }
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
      if (focus?.shards) disposeShards(focus.shards);
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
