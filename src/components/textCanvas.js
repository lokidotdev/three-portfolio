import * as THREE from "three";

import { HERO_TEXT } from "@/config/sceneConfig";

// Draw the hero text to an offscreen 2D canvas and wrap it in a CanvasTexture,
// as a drop-in replacement for the baked portfolio.png. The text is black on a
// transparent canvas so the distortion shader's alpha compositing keeps working
// unchanged (empty pixels -> alpha 0 -> white background). Uses a web-safe font
// so no async font loading is needed. Returns the texture and its aspect ratio.
export const makeTextTexture = (cfg = HERO_TEXT) => {
  const canvas = document.createElement("canvas");
  canvas.width = cfg.width;
  canvas.height = cfg.height;
  const ctx = canvas.getContext("2d");

  const lines = cfg.lines;
  const padX = cfg.paddingX * cfg.width;
  const maxWidth = cfg.width - padX * 2;
  const setFont = (px) =>
    (ctx.font = `${cfg.fontWeight} ${px}px ${cfg.fontFamily}`);

  // Pick the font size: start from fontScale of the height, then (when fitWidth)
  // shrink so the widest line fits inside the padding box — matching the way the
  // original artwork spans the canvas.
  let fontSize = cfg.fontScale * cfg.height;
  setFont(fontSize);
  let widest = 0;
  for (const line of lines) widest = Math.max(widest, ctx.measureText(line).width);
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
    cfg.align === "left"
      ? padX
      : cfg.align === "right"
      ? cfg.width - padX
      : cfg.width / 2;
  // Centre of the first line, so the whole block is centred on centerY.
  const firstY = cfg.centerY * cfg.height - blockH / 2 + lineH / 2;
  lines.forEach((line, i) => ctx.fillText(line, x, firstY + i * lineH));

  // Tight vertical extent of the drawn glyphs (canvas px), from the actual
  // glyph metrics. Used by the intro reveal to place a clip line at the text's
  // baseline so it can rise into view from "behind" it.
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
    top: 1 - topPx / cfg.height,
    bottom: 1 - bottomPx / cfg.height,
  };

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return { texture, aspect: cfg.width / cfg.height, band };
};
