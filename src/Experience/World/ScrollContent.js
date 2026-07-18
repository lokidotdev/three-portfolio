import * as THREE from "three";
import Experience from "../Experience.js";

import { SCROLL, SECTIONS } from "../sceneConfig.js";
import { makeSectionsTexture } from "./sectionsTexture.js";

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smoothstep = (x) => x * x * (3 - 2 * x);

// One plane carrying every section. It takes the focused panel's place once
// that panel breaks: one page wide (the panel's own size) and one page per
// section tall, mounted at opacity 0 the moment the panel shatters and faded up
// over the first fadeDistance of scroll as the shards and title fade away, so
// the two crossfade. It also starts sliding from that same first pixel, so the
// sections flow past continuously like a normal page — a single mesh and a
// single texture, never swapped (see sectionsTexture). It lives in the ring
// group, so the tilt and framing come for free.
export default class ScrollContent {
  constructor() {
    this.experience = new Experience();

    this.current = null;
    this.parent = null;
    this.base = new THREE.Vector3();
    this.pageHeight = 1;
    this.height = 1;

    this.material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      // The plane is only ever seen head-on over a fading panel; skipping depth
      // writes keeps it from cutting into the shards while they crossfade.
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.visible = false;
    // No texture yet: the first one is drawn at the panel's aspect in attach.
  }

  // Mounted when the focused panel breaks apart. `panel` is that panel, already
  // in its focused (pulled-in, flattened) transform; `parent` is the ring group
  // the shards were added to.
  attach(panel, parent) {
    const { width, height } = panel.geometry.parameters;
    // A page is exactly the panel it replaces; the plane is all of them stacked.
    this.pageHeight = height;
    this.height = height * SECTIONS.length;

    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.PlaneGeometry(width, this.height);
    this.mesh.quaternion.copy(panel.quaternion);
    // The panel's own focused spot. setScroll drops the plane below it and
    // rises into place from there, reading both offsets fresh each frame so
    // they can be dragged live in the debug UI.
    this.base.copy(panel.position);
    this.mesh.position.copy(this.base);

    this.current?.texture.dispose();
    this.current = makeSectionsTexture(SECTIONS, width / height, this.experience.resources);
    this.material.map = this.current.texture;
    this.material.needsUpdate = true;

    this.parent = parent;
    parent.add(this.mesh);
  }

  // The panel is being reassembled (scrolled back up and navigated home), so
  // the plane goes away until the next one breaks.
  detach() {
    this.parent?.remove(this.mesh);
    this.parent = null;
    this.material.opacity = 0;
    this.mesh.visible = false;
  }

  // vy is scroll position in viewport heights (0 at the top of the route).
  // Everything here is a pure function of vy, so scrolling back up plays the
  // whole thing in reverse for free.
  setScroll(vy) {
    if (!this.parent) return;

    // Entry runs over the same distance as the shard/title fade, so the plane
    // arrives exactly as they leave.
    const entry = smoothstep(clamp01(vy / SCROLL.fadeDistance));

    // Which page sits in the window, as a float. The plane slides a page per
    // sectionDistance of scroll from the very first pixel — a continuous page
    // scroll rather than holding on the first section through the crossfade —
    // and stops on the last one. The crossfade (entry, above) rides on top of
    // this motion, so the sections flow past like a normal page.
    const page = Math.min(
      SECTIONS.length - 1,
      vy / SCROLL.sectionDistance
    );

    // Bring page `page` to the panel's spot: the plane's centre starts half its
    // height above the first page's centre, and climbs a page at a time.
    const slotY = this.base.y - SCROLL.contentDrop;
    this.mesh.position.y =
      slotY -
      this.height / 2 +
      this.pageHeight * (page + 0.5) -
      SCROLL.contentRise * (1 - entry);

    this.material.opacity = entry;
    this.mesh.visible = entry > 0.001;
  }

  destroy() {
    this.detach();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.current?.texture.dispose();
  }
}
