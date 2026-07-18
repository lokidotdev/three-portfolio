import * as THREE from "three";
import Experience from "../Experience.js";

import Shatter from "./Shatter.js";
import { CYLINDER, SCROLL, TEXT } from "../sceneConfig.js";

const smoothstep = (x) => x * x * (3 - 2 * x);

const FOCUS_DURATION = 0.7; // seconds — pull-in / flatten phase
const TEXT_FLATTEN_DURATION = 0.5; // seconds — title glass -> flat black 2D
const SHATTER_DURATION = 0.9; // seconds — break-apart / scatter phase

// Clicking a panel fades and removes every other panel (and all titles), then
// flattens the chosen panel and eases it toward the camera. The animation is
// fully reversible and driven by the route: focusing a panel navigates to its
// slug; returning to "/" plays it backward.
export default class Focus {
  constructor() {
    this.experience = new Experience();
    this.world = this.experience.world;
    this.pointer = this.experience.pointer;
    this.debug = this.experience.debug;

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    // Non-null while a panel is focused or mid-transition.
    //   p   0 = ring, 1 = fully focused (pull-in / flatten)
    //   tx  title glass -> flat black 2D
    //   s   shatter / scatter
    //   dir "in" | "out" — which target the phases ease toward
    this.state = null;
    // 0 = shards/title fully visible, 1 = fully scrolled-away (see setScroll).
    this.scrollFade = 0;

    this.pointer.on("click", (x, y) => this.selectAt(x, y));
    this.setDebug();

    // Honor the initial URL (e.g. a direct load / refresh on a panel route).
    this.onRoute(this.experience.pathname);
  }

  get active() {
    return this.state !== null;
  }

  selectAt(clientX, clientY) {
    if (this.state) return;
    const rect = this.experience.canvas.getBoundingClientRect();
    this.ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.ndc, this.experience.camera.instance);
    const hit = this.raycaster.intersectObjects(
      this.world.cylinder.meshes,
      false
    )[0];
    // The URL is swapped to the panel's slug once the animation finishes (see
    // update), not on click.
    if (hit) this.begin(hit.object);
  }

  // Driven by scroll position once a panel is fully focused (see World.setScroll).
  setScroll(fade) {
    this.scrollFade = fade;
  }

  onRoute(path) {
    const slug = (path || "/").replace(/^\/+/, "");
    if (!slug) {
      // Home: reverse any active focus back to the ring. Nothing is restored by
      // hand here — the page scrolls back to the top on a route change, and
      // update() holds the reverse until that eased scroll has unwound, so the
      // shards and title fade back in rather than snapping to full opacity.
      if (this.state) this.state.dir = "out";
      return;
    }
    if (this.state) {
      // A different focus is in progress; ignore.
      if (this.state.selected.userData.slug === slug) this.state.dir = "in";
      return;
    }
    const target = this.world.cylinder.meshes.find(
      (panel) => panel.userData.slug === slug
    );
    if (target) this.begin(target);
  }

  begin(selected) {
    if (this.state) return;

    // Give the selected panel its own material so flattening it doesn't affect
    // the other panels sharing this texture's material.
    selected.material = selected.material.clone();
    const basePos = selected.userData.basePos;
    // Outward direction in the ring's space (the panel faces this way).
    const outward = new THREE.Vector3(basePos.x, 0, basePos.z).normalize();

    const textWrapper = this.world.titles.find(selected.userData.index);
    if (textWrapper) {
      // Own material, so straightening/keeping-visible doesn't touch the other
      // titles (which share materials and get faded out).
      const textMesh = textWrapper.children[0];
      textMesh.material = textMesh.material.clone();
      textMesh.material.userData.uBend = { value: 1 };
    }

    // The non-selected panels fade out via alpha, so they need to blend — but
    // only for the duration of the focus. They're restored to opaque on the way
    // back so the glass titles refract them again in the ring state.
    const others = this.world.cylinder.meshes.filter(
      (panel) => panel !== selected
    );
    for (const panel of others) panel.material.transparent = true;

    this.state = {
      selected,
      others,
      outward,
      basePos,
      textWrapper,
      textBasePos: textWrapper ? textWrapper.userData.basePos : null,
      p: 0,
      tx: 0,
      s: 0,
      shatter: null,
      detached: false,
      navigated: false,
      dir: "in",
    };
  }

  // Blend the focused title from clear glass (k = 0) to flat, matte black 2D
  // text (k = 1): drop the transmission/clearcoat glass response, darken to
  // black, and collapse the extrusion. The material is cloned per focus (see
  // begin), so this only touches the selected title. Values are absolute in k,
  // so it reverses cleanly.
  applyTitleFlatten(mesh, k) {
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
  }

  setDebug() {
    // Values are read each time a panel breaks, so changes take effect on the
    // next focus.
    this.debug.whenReady((ui) => {
      const scroll = ui.addFolder("Scroll");
      scroll.add(SCROLL, "ease", 0.02, 1, 0.01).name("scroll ease");
      scroll.add(SCROLL, "fadeDistance", 0.1, 2, 0.05).name("crossfade (vh)");
      scroll.add(SCROLL, "sectionDistance", 0.3, 2, 0.05).name("section step (vh)");
      scroll.add(SCROLL, "titleRise", 0, 2, 0.01).name("title rise");
      // Read every frame from the plane's base, so these two drag live.
      scroll.add(SCROLL, "contentDrop", -1, 1, 0.01).name("content drop");
      scroll.add(SCROLL, "contentRise", 0, 1, 0.01).name("content rise");

      const folder = ui.addFolder("Shatter");
      folder.add(CYLINDER, "shatterPieces", 6, 80, 1).name("pieces");
      folder.add(CYLINDER, "shatterMinX", 0, 3, 0.01).name("scatter x min");
      folder.add(CYLINDER, "shatterX", 0, 3, 0.01).name("scatter x max");
      folder.add(CYLINDER, "shatterMinY", 0, 3, 0.01).name("scatter y min");
      folder.add(CYLINDER, "shatterY", 0, 3, 0.01).name("scatter y max");
      folder.add(CYLINDER, "shatterMinZ", 0, 3, 0.01).name("scatter z min (depth)");
      folder.add(CYLINDER, "shatterZ", 0, 3, 0.01).name("scatter z max (depth)");
      folder.add(CYLINDER, "shatterCentreX", 0, 3, 0.01).name("centre gap x");
      folder.add(CYLINDER, "shatterCentreY", 0, 3, 0.01).name("centre gap y");
      folder.add(CYLINDER, "shatterCentreZ", 0, 3, 0.01).name("centre gap z");
      folder.add(CYLINDER, "shatterTumble", 0, 4, 0.01).name("tumble");
      folder.add(CYLINDER, "shatterParallax", 0, 1, 0.01).name("parallax");
    });
  }

  update() {
    const focus = this.state;
    if (!focus) return;

    const dt = this.experience.time.delta;
    const { heroText, cylinder, titles } = this.world;
    const ring = cylinder.group;

    const goingIn = focus.dir === "in";
    const stepP = dt / FOCUS_DURATION;
    const stepTx = dt / TEXT_FLATTEN_DURATION;
    const stepS = dt / SHATTER_DURATION;

    // Reversing away from a scrolled panel: the scroll has to come back up
    // before the panel can reassemble, or the shards would rush home while
    // still invisible and pop into view at the end.
    const unwinding = !goingIn && this.scrollFade > 0.001;

    // Forward runs p, then tx, then s (s starts once tx passes 0.5); reverse
    // unwinds them in reverse order: reassemble (s), un-flatten the title (tx),
    // then un-pull the panel (p).
    if (goingIn) {
      focus.p = Math.min(1, focus.p + stepP);
    } else if (unwinding) {
      // Hold every phase where it is; the scroll block below plays the fade
      // backwards as the eased scroll returns to the top.
    } else if (focus.s > 0) {
      focus.s = Math.max(0, focus.s - stepS);
    } else if (focus.tx > 0) {
      focus.tx = Math.max(0, focus.tx - stepTx);
    } else {
      focus.p = Math.max(0, focus.p - stepP);
    }
    const e = smoothstep(focus.p);

    // As the panel straightens, stagger the hero text up and out of view;
    // reverse it back in on the way home.
    heroText.setExit(e);

    // Reversing out: make sure removed panels are back in the ring to fade in.
    if (!goingIn && focus.detached && focus.s <= 0) {
      for (const panel of focus.others) ring.add(panel);
      focus.detached = false;
    }

    // Fade the other panels and the other titles with progress. The selected
    // title uses its own cloned material, so the shared ones only fade the
    // non-selected titles.
    for (const panel of focus.others) {
      panel.material.uniforms.uOpacity.value = 1 - e;
    }
    for (const material of titles.materials) material.opacity = 1 - e;

    // Straighten the chosen panel and ease it toward the camera.
    focus.selected.material.uniforms.uBend.value = 1 - e;
    focus.selected.position
      .copy(focus.basePos)
      .addScaledVector(focus.outward, e * CYLINDER.focusPull);

    // The title follows: straighten it and move it forward the same amount,
    // keeping it opaque so it reads as the focused panel's label. Once focused
    // it pushes further out, drifts up and flattens to black before the break.
    if (focus.textWrapper) {
      const textMesh = focus.textWrapper.children[0];
      textMesh.material.opacity = 1;
      textMesh.material.userData.uBend.value = 1 - e;
      const txe = smoothstep(focus.tx);
      focus.textWrapper.position
        .copy(focus.textBasePos)
        .addScaledVector(
          focus.outward,
          e * CYLINDER.focusPull + txe * CYLINDER.textFlattenForward
        );
      focus.textWrapper.position.y += txe * CYLINDER.textFlattenUp;
      this.applyTitleFlatten(textMesh, txe);
    }

    if (goingIn && focus.p >= 1) {
      // Fully focused: detach the faded panels and swap the URL to the slug.
      if (!focus.detached) {
        for (const panel of focus.others) ring.remove(panel);
        focus.detached = true;
      }
      if (!focus.navigated) {
        focus.navigated = true;
        this.experience.router.push(`/${focus.selected.userData.slug}`, {
          scroll: false,
        });
      }
      focus.tx = Math.min(1, focus.tx + stepTx);
      // Only once the title transition is half done does the panel break apart.
      if (focus.tx >= 0.5) {
        if (!focus.shatter) {
          focus.shatter = new Shatter(focus.selected, ring);
          focus.selected.visible = false;
          // The replacement plane mounts here, at opacity 0 — scrolling fades
          // it up as the shards it replaces fade out.
          this.world.scrollContent.attach(focus.selected, ring);
        }
        focus.s = Math.min(1, focus.s + stepS);
      }
    }

    if (focus.shatter) {
      focus.shatter.update(smoothstep(focus.s), this.pointer.current);
      // Reassembled during reverse: drop the shards, show the solid panel.
      if (!goingIn && focus.s <= 0) {
        focus.shatter.destroy();
        focus.shatter = null;
        focus.selected.visible = true;
        this.world.scrollContent.detach();
      }
    }

    if (!goingIn && focus.p <= 0 && !focus.shatter) {
      // Fully back to the ring: restore state and release the focus lock.
      focus.selected.material.uniforms.uBend.value = 1;
      focus.selected.material.uniforms.uOpacity.value = 1;
      focus.selected.material.transparent = false;
      focus.selected.position.copy(focus.basePos);
      focus.selected.visible = true;
      // Return the faded panels to opaque so the titles refract them again.
      for (const panel of focus.others) {
        panel.material.uniforms.uOpacity.value = 1;
        panel.material.transparent = false;
      }
      if (focus.textWrapper) {
        focus.textWrapper.children[0].material.userData.uBend.value = 1;
        focus.textWrapper.position.copy(focus.textBasePos);
      }
      this.state = null;
    }

    // Fully settled on a panel (not mid transition): scrolling drifts the
    // flattened title up as it fades, fades the shards out over the same
    // distance, then detaches them once they're invisible. Every value is
    // absolute in the scroll position, so scrolling back up reverses it — and
    // it runs while reversing too, so leaving the route unwinds it smoothly.
    if (focus.p >= 1 && focus.tx >= 1) {
      const sf = smoothstep(this.scrollFade);
      const opacity = 1 - sf;
      const gone = this.scrollFade >= 1;
      // The content plane is tall enough to pass through the floor, so the
      // mirror goes with the shards.
      this.world.floor.setScrollFade(sf);
      // The shards share the panel's material, so this one uniform fades both.
      focus.selected.material.uniforms.uOpacity.value = opacity;
      focus.selected.material.transparent = true;
      // Only ever the shards *or* the solid panel — once it has broken, the
      // panel stays hidden and its shards carry the fade.
      focus.selected.visible = !gone && !focus.shatter;
      if (focus.shatter) {
        // Taken out of the ring rather than destroyed: rebuilding the Voronoi
        // fracture on every scroll back would be far more work than re-adding
        // the group, and the shards' scatter would change under the user.
        const attached = focus.shatter.group.parent !== null;
        if (gone && attached) ring.remove(focus.shatter.group);
        else if (!gone && !attached) ring.add(focus.shatter.group);
      }
      if (focus.textWrapper) {
        const textMesh = focus.textWrapper.children[0];
        textMesh.material.opacity = opacity;
        textMesh.visible = !gone;
        focus.textWrapper.position.y += sf * SCROLL.titleRise;
      }
    }
  }

  destroy() {
    this.pointer.off("click");
    this.state?.shatter?.destroy();
  }
}
