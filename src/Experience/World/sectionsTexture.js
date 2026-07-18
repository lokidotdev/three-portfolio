import * as THREE from "three";

import { drawTextBlock } from "./heroTextTexture.js";
import { SECTION_IMAGES, sectionImageName } from "../sceneConfig.js";

// Every section drawn onto one tall canvas, stacked top to bottom, one "page"
// each. The plane it maps onto is one page wide and N pages tall, so scrolling
// slides the whole thing up through the same window (see ScrollContent) rather
// than swapping textures.
//
// `pageAspect` is the width/height of a single page — the panel's aspect, so a
// page fills exactly the space the broken panel left. The canvas is capped to
// MAX_PIXELS on its long side: stacking N pages at full resolution would
// otherwise sail past what smaller GPUs will allocate.
const MAX_PIXELS = 4096;

// A section's `images` (see sceneConfig.SECTIONS), drawn in a centred row
// below its text block. Images are loaded up front via sources.js under the
// name sectionImageName(cfg, i) — resources is Experience.resources, always
// ready by the time a panel can be focused/broken, so any entry not found
// there is simply skipped rather than drawn blank.
const drawImages = (ctx, cfg, resources, box, textBottom) => {
  const entries = cfg.images
    .map((image, i) => ({ image, texture: resources?.items?.[sectionImageName(cfg, i)] }))
    .filter((entry) => entry.texture);
  if (!entries.length) return;

  const gap = SECTION_IMAGES.gap * box.w;
  const widths = entries.map((entry) => (entry.image.width ?? SECTION_IMAGES.width) * box.w);
  const totalW = widths.reduce((a, b) => a + b, 0) + gap * (entries.length - 1);

  let x = box.x + box.w / 2 - totalW / 2;
  const y = textBottom + SECTION_IMAGES.marginTop * box.h;

  entries.forEach((entry, i) => {
    const w = widths[i];
    const img = entry.texture.image;
    const h = w * (img.height / img.width);
    ctx.drawImage(img, x, y, w, h);
    x += w + gap;
  });
};

export const makeSectionsTexture = (sections, pageAspect, resources) => {
  const first = sections[0];
  const count = sections.length;

  let pageH = Math.min(first.width, first.height);
  let w = Math.round(pageH * pageAspect);
  const fit = Math.min(1, MAX_PIXELS / (pageH * count), MAX_PIXELS / w);
  if (fit < 1) {
    pageH = Math.floor(pageH * fit);
    w = Math.round(pageH * pageAspect);
  }
  const h = pageH * count;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  // Opaque, unlike the hero text: this one reads as a solid card, not as
  // glyphs keyed against the background.
  if (first.background) {
    ctx.fillStyle = first.background;
    ctx.fillRect(0, 0, w, h);
  }

  sections.forEach((cfg, i) => {
    const box = { x: 0, y: i * pageH, w, h: pageH };
    const { bottom } = drawTextBlock(ctx, cfg, box);
    if (cfg.images?.length) drawImages(ctx, cfg, resources, box, bottom);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return { texture, pages: count };
};
