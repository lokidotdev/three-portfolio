import * as THREE from "three";

import { CYLINDER } from "../sceneConfig.js";

// Uniform pick in [min, max]; tolerates a min dragged above max in the GUI.
const randRange = (min, max) =>
  Math.min(min, max) + Math.random() * Math.abs(max - min);
// Same, but with a random sign — magnitude never falls below min.
const signedScatter = (min, max) =>
  (Math.random() < 0.5 ? -1 : 1) * randRange(min, max);

// Clip a convex polygon (array of [x, y]) to the half-plane of points on the
// near side of a line through `a` with outward normal `n` (Sutherland-Hodgman,
// single edge). Keeps points where dot(p - a, n) <= 0.
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

// The centre gaps describe a box around the panel's centre (0,0,0 in the shard
// group's frame) that shards keep out of. A shard is only moved if its final
// position is inside the box on *every* axis — clearing any one axis is enough,
// so a shard already past the y gap is free to sit anywhere in x. Axes left at 0
// don't bound the box: with z at 0 the gaps carve a hole through the panel face
// at any depth. Shards inside escape by the shortest push, on the side they were
// already heading, so the scatter keeps its direction and only its distance
// changes. Mutates `scatter`.
const clearCentre = (home, scatter) => {
  // x/y run either side of the centre; z only ever pushes outward toward the
  // camera, so it's measured one-sided.
  const axes = [
    { k: "x", f: home.x + scatter.x, gap: CYLINDER.shatterCentreX, signed: true },
    { k: "y", f: home.y + scatter.y, gap: CYLINDER.shatterCentreY, signed: true },
    { k: "z", f: home.z + scatter.z, gap: CYLINDER.shatterCentreZ, signed: false },
  ].filter((a) => a.gap > 0);
  if (!axes.length) return;

  // Depth into the box per axis; the shallowest is the cheapest way out.
  let escape = null;
  for (const a of axes) {
    const depth = a.gap - (a.signed ? Math.abs(a.f) : a.f);
    if (depth <= 0) return; // already clear on this axis — box doesn't apply
    if (!escape || depth < escape.depth) escape = { ...a, depth };
  }

  // A shard sitting dead-centre has no side to favour — pick one.
  const side = !escape.signed
    ? 1
    : Math.abs(escape.f) > 1e-4
      ? Math.sign(escape.f)
      : Math.random() < 0.5
        ? -1
        : 1;
  scatter[escape.k] = side * escape.gap - home[escape.k];
};

// Breaks a focused panel into irregular Voronoi shards: each cell is the panel
// rectangle clipped by the perpendicular bisector to every other seed, so the
// fracture lines look like a real broken plate rather than a grid. Shards share
// the panel's (now flat) material and reassemble it.
export default class Shatter {
  constructor(panel, parent) {
    this.parent = parent;
    this.group = new THREE.Group();
    // Match the panel's focused transform so shards start exactly on it.
    this.group.position.copy(panel.position);
    this.group.quaternion.copy(panel.quaternion);

    this.build(panel);
    this.parent.add(this.group);
  }

  build(panel) {
    const arc = panel.geometry.parameters.width;
    const h = panel.geometry.parameters.height;
    const hw = arc / 2;
    const hh = h / 2;

    const n = Math.max(3, Math.round(CYLINDER.shatterPieces));
    const seeds = [];
    for (let i = 0; i < n; i++) {
      seeds.push([(Math.random() - 0.5) * arc, (Math.random() - 0.5) * h]);
    }

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
        poly = clipHalfPlane(poly, (sx + ox) / 2, (sy + oy) / 2, ox - sx, oy - sy);
      }
      if (poly.length < 3) continue;

      // Centroid → the shard pivots (and scatters/tumbles) about its own centre.
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

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3)
      );
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));

      const shard = new THREE.Mesh(geometry, panel.material);
      const home = new THREE.Vector3(cx, cy, 0);
      shard.position.copy(home);
      // Random scatter within [min, max] per axis: spread across/up the panel
      // and pushed outward toward the camera (z stays positive). Then hold the
      // per-axis gap around the panel's centre.
      const scatter = new THREE.Vector3(
        signedScatter(CYLINDER.shatterMinX, CYLINDER.shatterX),
        signedScatter(CYLINDER.shatterMinY, CYLINDER.shatterY),
        randRange(CYLINDER.shatterMinZ, CYLINDER.shatterZ)
      );
      clearCentre(home, scatter);
      shard.userData = {
        home,
        scatter,
        tumble: new THREE.Euler(
          (Math.random() - 0.5) * CYLINDER.shatterTumble,
          (Math.random() - 0.5) * CYLINDER.shatterTumble,
          (Math.random() - 0.5) * CYLINDER.shatterTumble
        ),
        // Depth-based parallax weight: shards flung further drift more.
        parallax: 0.4 + Math.random(),
      };
      this.group.add(shard);
    }
  }

  // Blend home <-> scattered, tumble, and drift with a mouse parallax that
  // grows as the shards scatter.
  update(progress, mouse) {
    const px = (mouse.x - 0.5) * 2 * CYLINDER.shatterParallax;
    const py = (mouse.y - 0.5) * 2 * CYLINDER.shatterParallax;
    for (const shard of this.group.children) {
      const ud = shard.userData;
      shard.position.copy(ud.home).addScaledVector(ud.scatter, progress);
      shard.position.x += px * ud.parallax * progress;
      shard.position.y += py * ud.parallax * progress;
      shard.rotation.set(
        ud.tumble.x * progress,
        ud.tumble.y * progress,
        ud.tumble.z * progress
      );
    }
  }

  destroy() {
    this.parent.remove(this.group);
    for (const shard of this.group.children) shard.geometry.dispose();
  }
}
