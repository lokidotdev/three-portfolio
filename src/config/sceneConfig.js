// Static configuration for the portfolio scene: asset URLs and the default
// values for every tunable effect parameter (all exposed via dat.GUI).

export const TEXTURE_URL = "/textures/portfolio.png";

// Background hero text, drawn to a canvas at runtime (see textCanvas.js) and fed
// to the full-screen distortion shader instead of a baked PNG — so the words are
// editable here in code and still ripple/split under the cursor. Black text on a
// transparent canvas: the shader keys off alpha, so empty areas read as the
// white background.
export const HERO_TEXT = {
  lines: ["PORTFOLIO"], // one entry per line; edit freely
  fontFamily: "Helvetica, Arial, sans-serif",
  fontWeight: 700,
  color: "#000000",
  width: 1920, // canvas resolution (sets the texture aspect)
  height: 1080,
  fitWidth: true, // scale the font so the widest line fills the padding box
  fontScale: 0.32, // font size as a fraction of height (used when fitWidth is off)
  lineHeight: 1.1, // line spacing as a multiple of font size
  align: "center", // left | center | right
  paddingX: 0.02, // horizontal inset as a fraction of width
  centerY: 0.26, // vertical centre of the text block as a fraction of height (0 = top)
};

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
  height: 2.0, // plane height
  gap: 0.005, // fractional gap between adjacent planes (near-continuous)
  tilt: -0.2, // tips the ring so a sliver of the open top shows
  spin: 0.15, // auto-rotation speed (rad/sec) — unused; ring is drag-controlled
  dragSensitivity: 0.001, // radians the ring turns per pixel of horizontal drag
  snapEase: 0.07, // how fast a panel recenters after release (0..1, higher = faster)
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
  focusPull: 0.6, // distance a selected panel eases toward the camera (world units)
  // --- Title flatten: after a panel is fully focused, its glass title pushes
  // further toward the camera and drifts up while turning into flat, matte
  // black 2D text (glass response drops, extrusion collapses). The plane break
  // only starts once this transition is half complete. ---
  textFlattenForward: 0.5, // extra distance the title eases toward the camera (world units)
  textFlattenUp: 0.15, // extra upward drift of the title (world units)
  textFlattenDepth: 0.06, // z-scale the extrusion collapses to (~2D)
  // --- Shatter: once a focused panel reaches its route, it breaks into a grid
  // of shards that scatter and then hover with a parallax drift. ---
  shatterPieces: 50, // number of irregular Voronoi fracture shards
  // Max scatter distance per axis (world units), in the flat panel's frame:
  // x = across the panel, y = up the panel, z = outward toward the camera.
  shatterX: 2.5,
  shatterY: 0.8,
  shatterZ: 0.2,
  shatterTumble: 1.0, // max random tumble of each shard (radians)
  shatterParallax: 0.35, // shard parallax drift per screen-half of mouse travel
};

// One-time load / intro sequence. The camera swoops from a top-down view of
// the ring into the resting eye-level view ("cylinder load"). Once that swoop
// is `revealAt` complete (~90%), the reflective floor eases up + fades in and
// the hero text staggers into view from behind a fixed clip line.
export const INTRO = {
  duration: 2.2, // seconds — camera swoop from top-down into the resting view
  startY: 11.0, // camera start height (looking straight down at the ring)
  startZ: 0.8, // slight z offset so the initial lookAt isn't singular
  revealAt: 0.5, // fraction of the swoop when the floor + hero text begin
  floorDuration: 0.7, // seconds — reflective floor rise + fade-in
  floorRise: 0.22, // world units the floor rises from below its resting y
  textDuration: 0.7, // seconds — hero text stagger reveal
  textStagger: 0.3, // left→right stagger spread (0 = together, 1 = fully sequential)
  textSlide: 1.5, // how far (× text height) the glyphs start below the clip line
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
