// Asset lists and the default values for every tunable parameter (all exposed
// via dat.GUI — see each class's setDebug).

export const FONT_URL = "/fonts/helvetiker_regular.typeface.json";

// Background hero text, drawn to a canvas at runtime (see heroTextTexture.js)
// and fed to the full-screen distortion shader instead of a baked PNG. Black
// text on a transparent canvas: the shader keys off alpha, so empty areas read
// as the white background.
export const HERO_TEXT = {
  lines: ["PORTFOLIO"], // one entry per line
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

// Panels applied around the ring in a loop. `name` keys the loaded texture in
// Resources; `title` becomes the floating glass label and the route slug.
export const PANELS = [
  { name: "fotf", src: "/textures/fotf.png", title: "Friends of the Future" },
  { name: "folio", src: "/textures/folio.png", title: "Portfolio" },
  { name: "montreal", src: "/textures/montreal.png", title: "Montreal" },
  { name: "promptboard", src: "/textures/promptboard.png", title: "PromptBoard" },
];

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

// Ring of vertical planes forming an open-top cylinder, rendered in front of
// the hero text with a separate perspective pass.
export const CYLINDER = {
  segments: 4, // number of planes around the ring (high = smooth cylinder)
  radius: 2.4, // ring radius (world units)
  height: 2.0, // plane height
  gap: 0.005, // fractional gap between adjacent planes (near-continuous)
  tilt: -0.2, // tips the ring so a sliver of the open top shows
  // --- Camera / responsive framing ---
  camY: 1.3, // camera height (near eye-level, slight downward look)
  camZ: 6.4, // camera distance
  frameAspect: 1.6, // viewport aspect camY/camZ are framed for
  maxDolly: 2.4, // max multiple of the resting distance on narrow viewports
  dragSensitivity: 0.001, // radians the ring turns per pixel of horizontal drag
  dragRefWidth: 1440, // viewport width dragSensitivity is tuned for
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
  // --- Title flatten (after a panel is fully focused) ---
  textFlattenForward: 0.5, // extra distance the title eases toward the camera
  textFlattenUp: 1.0, // extra upward drift of the title (world units)
  textFlattenDepth: 0.06, // z-scale the extrusion collapses to (~2D)
  // --- Shatter ---
  shatterPieces: 50, // number of irregular Voronoi fracture shards
  // Scatter distance per axis (world units) in the flat panel's frame: x across
  // the panel, y up it, z outward toward the camera. Each shard lands somewhere
  // in [min, max]; x/y keep a random sign, so their min is how far a shard must
  // travel from home before it can stop.
  shatterMinX: 0.0,
  shatterX: 2.5,
  shatterMinY: 0.0,
  shatterY: 0.8,
  shatterMinZ: 0.0,
  shatterZ: 0.2,
  // Half-extents of a box around the panel's centre that shards keep out of.
  // These measure a shard's final position from the centre, and bound each
  // other: a shard only moves if it's inside the box on every axis at once. An
  // axis left at 0 doesn't bound the box.
  shatterCentreX: 0.0,
  shatterCentreY: 0.0,
  shatterCentreZ: 0.0,
  shatterTumble: 1.0, // max random tumble of each shard (radians)
  shatterParallax: 0.35, // shard parallax drift per screen-half of mouse travel
};

// Panel routes are scrollable: scrolling fades out the focused panel's shards
// and title, then reveals each section's text on a WebGL plane (same
// canvas-texture technique as HeroText). Distances are in viewport heights.
export const SCROLL = {
  ease: 0.9, // how fast the scene catches up to the page's scroll (0..1 per frame)
  // The shards/title fade 1 -> 0 and the content plane fades 0 -> 1 across this
  // same distance — they crossfade rather than waiting on each other.
  fadeDistance: 0.5, // scroll (vh) over which the swap happens
  titleRise: 0.5, // world units the title drifts up as it fades out
  contentDrop: 1.0, // world units the content plane sits below the panel's centre
  contentRise: 0.25, // world units it eases up through as it fades in
  sectionDistance: 0.7, // scroll (vh) it takes to slide on to the next section
};

// Text drawn to the content plane once scrolled past a panel's focused state.
// Edit freely — same shape as HERO_TEXT (reused by makeHeroTextTexture). One
// font size covers every line of a section, so the first line reads as the
// heading by being short and capitalised rather than by being styled larger.
// `options` overrides any of the defaults below per-section — fontScale and
// align are the ones worth varying section to section; images is additive.
const section = (id, lines, options = {}) => ({
  id,
  lines,
  fontFamily: "Helvetica, Arial, sans-serif",
  fontWeight: 700,
  color: "#000000",
  background: "#e6e6e6", // fills the canvas so the plane reads as a solid card
  width: 1920,
  height: 1080,
  fitWidth: false, // keep every section at the same size; lines are short enough
  fontScale: 0.075, // font size as a fraction of height
  lineHeight: 2.0,
  align: "left", // left | center | right
  paddingX: 0.06,
  centerY: 0.5,
  images: [], // optional [{ src, width? }] — see SECTION_IMAGES, drawn in sectionsTexture
  ...options,
});

// Layout for a section's `images` row, drawn below its text block once loaded
// (see sectionImageName + sectionsTexture). Shared by every section; each
// image entry can override its own `width`.
export const SECTION_IMAGES = {
  width: 0.26, // default image width, as a fraction of the page width
  gap: 0.04, // horizontal gap between images, as a fraction of page width
  marginTop: 0.08, // gap between the text block and the image row, fraction of page height
};

// Deterministic resource name for a section image, shared by sources.js
// (which loads it) and sectionsTexture.js (which looks up the loaded texture).
export const sectionImageName = (section, index) => `section-${section.id}-${index}`;

export const SECTIONS = [
  section(
    "projects",
    [
      "PROJECTS",
      "Friends of the Future — WebGL identity",
      "Folio — portfolio system",
      "Montreal — interactive city map",
      "PromptBoard — realtime collaboration",
    ],
    {
      align: "left",
      fontScale: 0.06,
      centerY: 0.32,
      images: [
        { src: "/textures/fotf.png" },
        { src: "/textures/folio.png" },
        { src: "/textures/montreal.png" },
      ],
    }
  ),
  section("skills", [
    "SKILLS",
    "Three.js · WebGL · GLSL",
    "React · Next.js · TypeScript",
    "GSAP · Motion design",
    "Blender · Figma",
  ]),
  section(
    "experience",
    [
      "EXPERIENCE",
      "2023 — now · Zero1 Studio",
      "Creative developer, interactive 3D",
      "2020 — 2023 · Freelance",
      "Sites, installations, prototypes",
    ],
    { align: "right", fontScale: 0.07 }
  ),
  section("contact", ["CONTACT", "hello@example.com", "@zero1studio"]),
];

// One-time load sequence: the camera swoops from a top-down view into the
// resting view; once `revealAt` through it, the floor eases up + fades in and
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

// 3D glass title text floating in front of each panel, rendered with a real
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
  attenuationColor: [255, 255, 255],
  attenuationDistance: 2.0,
  // --- Dispersion / iridescence ---
  dispersion: 0.0, // splits refracted light into colour fringes (needs transmission)
  iridescence: 0.0, // 0 = off, 1 = full thin-film effect
  iridescenceIOR: 1.3, // refractive index of the thin film
};
