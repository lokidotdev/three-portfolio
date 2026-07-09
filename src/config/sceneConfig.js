// Static configuration for the portfolio scene: asset URLs and the default
// values for every tunable effect parameter (all exposed via dat.GUI).

export const TEXTURE_URL = "/textures/portfolio.png";

// Textures for the cylinder planes — every image in /textures except the
// portfolio artwork (used by the text effect), applied around the ring in a loop.
export const CYLINDER_TEXTURE_URLS = [
  {
    src: "/textures/fotf.png",
    title: "Friends of the Future",
  },
  {
    src: "/textures/folio.png",
    title: "Portfolio",
  },
  {
    src: "/textures/montreal.png",
    title: "Montreal",
  },
  {
    src: "/textures/promptboard.png",
    title: "PromptBoard",
  },
];

// Default effect configuration — every value is exposed via dat.GUI.
export const CONFIG = {
  // Distortion (shader)
  strength: 2.07,
  rippleStrength: 0.018,
  pushStrength: 0.07,
  caStrength: 0.0095,
  glowStrength: 6.3,
  waveFreq: 7.0,
  waveSpeed: 1.9,
  falloff: 2.0,
  radius: 0.35, // overall size of the distorted area
  spreadAlong: 0.3, // reach along movement axis (1,1 = circular)
  spreadAcross: 0.2, // reach perpendicular to movement
  glowColor: [255, 255, 255], // rgb 0..255 for dat.GUI colour picker
  // Motion (JS)
  velocityGain: 11.5,
  velocityDecay: 0.91,
  mouseEase: 0.64,
  responseSpeed: 0.02, // how fast the distortion ramps up / settles
};

// Ring of vertical planes forming an open-top cylinder (rendered in front of
// the text effect with a separate perspective pass).
export const CYLINDER = {
  segments: 4, // number of planes around the ring (high = smooth cylinder)
  radius: 2.4, // ring radius (world units)
  height: 2.2, // plane height
  gap: 0.005, // fractional gap between adjacent planes (near-continuous)
  tilt: -0.2, // tips the ring so a sliver of the open top shows
  spin: 0.15, // auto-rotation speed (rad/sec) — unused; ring is drag-controlled
  dragSensitivity: 0.001, // radians the ring turns per pixel of horizontal drag
  snapEase: 0.02, // how fast a panel recenters after release (0..1, higher = faster)
  coastDecay: 0.9, // inertia decay per frame after release (0..1, lower = stops sooner)
  baseGap: 0.1, // vertical gap between the cylinder base and the reflective floor
  reflectivity: 1.0, // 0 = white floor (no mirror), 1 = full reflection
  reflectionFadeStart: 0.22, // reflection stays full within this radius (0..1 of the disk)
  reflectionFadeEnd: 0.9, // reflection fully faded to transparent by this radius (0..1)
  floorScale: 2.0, // reflective floor radius as a multiple of the ring radius
  planeColor: [230, 230, 230], // solid card colour behind the text (rgb 0..255)
  depth: 0.12, // box thickness (kept low so it still reads as a plane)
  parallax: 0.3, // camera offset per screen-half of mouse travel (world units)
  parallaxEase: 0.01, // how quickly the camera drifts toward the mouse
};

// 3D glass title text floating in front of each panel. Rendered with a real
// transmission material so the panel behind is refracted through the letters.
export const TEXT = {
  size: 0.22, // font size (world units)
  depth: 0.05, // extrusion depth
  offset: 0.08, // distance in front of the panel surface
  color: [255, 255, 255], // glass tint (white = clear)
  transmission: 1.0, // 1 = fully see-through glass
  roughness: 0.06, // low = crisp, clear glass; higher = frosted
  thickness: 0.5, // volume the light travels through (bends refraction)
  ior: 1.5, // index of refraction (1.5 ≈ real glass)
  // --- Surface & reflections ---
  clearcoat: 1.0, // thin glossy lacquer layer on top (0 = none)
  clearcoatRoughness: 0.1, // 0 = mirror-sharp coat, higher = hazy sheen
  reflectivity: 0.5, // Fresnel reflectance at normal incidence (non-metal F0)
  specularIntensity: 1.0, // strength of specular highlights
  envMapIntensity: 1.0, // how strongly the room environment reflects/refracts
  // --- Volume absorption (tinted glass) ---
  // Light travelling through the glass is tinted toward attenuationColor over
  // attenuationDistance. Large distance ≈ clear; small + coloured ≈ stained glass.
  attenuationColor: [255, 255, 255],
  attenuationDistance: 2.0,
  // --- Dispersion (prism rainbow through refraction) ---
  dispersion: 0.0, // splits refracted light into colour fringes (needs transmission)
  // --- Iridescence (thin-film soap-bubble / oil-slick sheen) ---
  iridescence: 0.0, // 0 = off, 1 = full thin-film effect
  iridescenceIOR: 1.3, // refractive index of the thin film
};
