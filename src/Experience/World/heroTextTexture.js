import * as THREE from "three";

import { HERO_TEXT } from "../sceneConfig.js";

// Draw the hero text to an offscreen 2D canvas and wrap it in a CanvasTexture.
// The text is black on a transparent canvas so the distortion shader's alpha
// compositing reads empty pixels as the white background. A web-safe font means
// no async font loading.
//
// The canvas is drawn at the viewport's aspect rather than cfg's, so the
// shader's cover-fit never has to crop it and the layout values (paddingX,
// centerY) read the same on a phone as on a desktop. cfg.width/height only set
// the resolution budget: the short side keeps min(width, height) pixels and the
// long side follows the aspect, so at 16:9 this reproduces cfg exactly.
export const makeHeroTextTexture = (
  cfg = HERO_TEXT,
  aspect = cfg.width / cfg.height
) => {
  const short = Math.min(cfg.width, cfg.height);
  const w = Math.min(4096, Math.round(aspect >= 1 ? short * aspect : short));
  const h = Math.min(4096, Math.round(aspect >= 1 ? short : short / aspect));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  const lines = cfg.lines;
  const padX = cfg.paddingX * w;
  const maxWidth = w - padX * 2;
  const setFont = (px) =>
    (ctx.font = `${cfg.fontWeight} ${px}px ${cfg.fontFamily}`);

  // Start from fontScale of the height, then (when fitWidth) shrink so the
  // widest line fits inside the padding box.
  let fontSize = cfg.fontScale * h;
  setFont(fontSize);
  let widest = 0;
  for (const line of lines) {
    widest = Math.max(widest, ctx.measureText(line).width);
  }
  if (cfg.fitWidth && widest > 0) {
    fontSize *= maxWidth / widest;
    setFont(fontSize);
  }

  ctx.fillStyle = cfg.color;
  ctx.textAlign = cfg.align;
  ctx.textBaseline = "middle";

  const lineH = fontSize * cfg.lineHeight;
  const blockH = lineH * lines.length;
  const x =
    cfg.align === "left" ? padX : cfg.align === "right" ? w - padX : w / 2;
  // Centre of the first line, so the whole block is centred on centerY.
  const firstY = cfg.centerY * h - blockH / 2 + lineH / 2;
  lines.forEach((line, i) => ctx.fillText(line, x, firstY + i * lineH));

  // Tight vertical extent of the drawn glyphs, from the actual glyph metrics.
  // The intro reveal clips at the text's baseline so it can rise into view from
  // "behind" it.
  let ascent = 0;
  let descent = 0;
  for (const line of lines) {
    const m = ctx.measureText(line);
    ascent = Math.max(ascent, m.actualBoundingBoxAscent || fontSize * 0.35);
    descent = Math.max(descent, m.actualBoundingBoxDescent || fontSize * 0.05);
  }
  const pad = fontSize * 0.06;
  const topPx = firstY - ascent - pad;
  const bottomPx = firstY + (lines.length - 1) * lineH + descent + pad;
  // Convert to texture uv (CanvasTexture flips Y, so uv.y = 1 - canvasY/height).
  // top > bottom because canvas Y grows downward.
  const band = {
    top: 1 - topPx / h,
    bottom: 1 - bottomPx / h,
  };

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return { texture, aspect: w / h, band };
};
