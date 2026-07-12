import { CONFIG, CYLINDER, TEXT } from "@/config/sceneConfig";

// Builds the dat.GUI control panel and wires every control to its live target.
// dat.gui touches `window` at import time, so it is imported client-side only
// by the caller; this receives the resolved GUI constructor plus the scene
// handles the controls mutate.
//
// deps: { GUI, uniforms, motion, planeMats, textMats, cylRoot, floor,
//         buildCylinder, buildText }
// Returns the created GUI instance (call .destroy() on cleanup).
export const createGui = ({
  GUI,
  uniforms: u,
  motion,
  planeMats,
  textMats,
  cylRoot,
  floor,
  buildCylinder,
  buildText,
}) => {
  const gui = new GUI({ width: 300 });

  const fx = gui.addFolder("Distortion");
  fx.add(u.uStrength, "value", 0, 3, 0.01).name("strength");
  fx.add(u.uPushStrength, "value", 0, 0.1, 0.001).name("push");
  fx.add(u.uRippleStrength, "value", 0, 0.1, 0.001).name("ripple");
  fx.add(u.uRadius, "value", 0.1, 4, 0.05).name("radius");
  fx.add(u.uSpreadAlong, "value", 0.2, 5, 0.05).name("spread along");
  fx.add(u.uSpreadAcross, "value", 0.2, 5, 0.05).name("spread across");
  fx.add(u.uCAStrength, "value", 0, 0.03, 0.0005).name("chromatic");
  fx.add(u.uGlowStrength, "value", 0, 12, 0.1).name("glow");
  fx.add(u.uWaveFreq, "value", 2, 80, 1).name("wave freq");
  fx.add(u.uWaveSpeed, "value", 0, 20, 0.1).name("wave speed");
  fx.add(u.uFalloff, "value", 1, 20, 0.1).name("falloff");
  fx.addColor(CONFIG, "glowColor")
    .name("glow color")
    .onChange((c) => u.uGlowColor.value.fromArray(c.map((v) => v / 255)));
  // fx.open();

  const mv = gui.addFolder("Motion");
  mv.add(motion, "responseSpeed", 0.02, 1, 0.01).name("speed");
  mv.add(motion, "velocityGain", 0, 20, 0.1).name("sensitivity");
  mv.add(motion, "velocityDecay", 0.5, 0.99, 0.01).name("decay");
  mv.add(motion, "mouseEase", 0.02, 1, 0.01).name("follow ease");
  // mv.open();

  const cyl = gui.addFolder("Cylinder");
  cyl.add(CYLINDER, "segments", 3, 40, 1).name("segments").onChange(buildCylinder);
  cyl.add(CYLINDER, "radius", 0.5, 5, 0.05).name("radius").onChange(buildCylinder);
  cyl.add(CYLINDER, "height", 0.2, 6, 0.05).name("height").onChange(buildCylinder);
  cyl.add(CYLINDER, "gap", 0, 0.5, 0.01).name("gap").onChange(buildCylinder);
  cyl.add(CYLINDER, "depth", 0.02, 0.6, 0.01).name("depth").onChange(buildCylinder);
  cyl
    .add(CYLINDER, "tilt", -1, 1, 0.01)
    .name("tilt")
    .onChange((v) => (cylRoot.rotation.x = v));
  cyl.add(CYLINDER, "dragSensitivity", 0.001, 0.02, 0.001).name("drag speed");
  cyl.add(CYLINDER, "snapEase", 0.02, 0.5, 0.01).name("recenter speed");
  cyl.add(CYLINDER, "coastDecay", 0.5, 0.98, 0.01).name("coast decay");
  cyl.add(CYLINDER, "parallax", 0, 2, 0.01).name("parallax");
  cyl.add(CYLINDER, "parallaxEase", 0.01, 0.3, 0.005).name("parallax ease");
  cyl
    .add(CYLINDER, "baseGap", 0, 2, 0.01)
    .name("base gap")
    .onChange((v) => (floor.position.y = -(CYLINDER.height / 2 + v)));
  cyl
    .add(CYLINDER, "reflectivity", 0, 1, 0.01)
    .name("reflectivity")
    .onChange((v) => (floor.material.uniforms.reflectivity.value = v));
  cyl
    .add(CYLINDER, "reflectionFadeStart", 0, 2, 0.01)
    .name("reflect fade start")
    .onChange((v) => (floor.material.uniforms.fadeStart.value = v));
  cyl
    .add(CYLINDER, "reflectionFadeEnd", 0, 4, 0.01)
    .name("reflect fade end")
    .onChange((v) => (floor.material.uniforms.fadeEnd.value = v));
  cyl
    .add(CYLINDER, "floorScale", 0.5, 5, 0.05)
    .name("floor radius")
    .onChange((v) => floor.scale.setScalar(CYLINDER.radius * v));
  cyl
    .addColor(CYLINDER, "planeColor")
    .name("card color")
    .onChange((c) => {
      for (const mat of planeMats)
        mat.uniforms.uCardColor.value.fromArray(c.map((v) => v / 255));
    });
  // cyl.open();

  // Shatter — tuning the fracture applied when a panel opens to its route.
  // Values are read each time a panel breaks, so changes take effect on the
  // next focus.
  const sh = gui.addFolder("Shatter");
  sh.add(CYLINDER, "shatterPieces", 6, 80, 1).name("pieces");
  sh.add(CYLINDER, "shatterX", 0, 3, 0.01).name("scatter x");
  sh.add(CYLINDER, "shatterY", 0, 3, 0.01).name("scatter y");
  sh.add(CYLINDER, "shatterZ", 0, 3, 0.01).name("scatter z (depth)");
  sh.add(CYLINDER, "shatterTumble", 0, 4, 0.01).name("tumble");
  sh.add(CYLINDER, "shatterParallax", 0, 1, 0.01).name("parallax");

  const txt = gui.addFolder("Text");
  txt.add(TEXT, "size", 0.05, 0.6, 0.01).name("size").onChange(buildText);
  txt.add(TEXT, "depth", 0.005, 0.2, 0.005).name("depth").onChange(buildText);
  txt.add(TEXT, "offset", 0, 0.5, 0.01).name("offset").onChange(buildText);
  txt.add(TEXT, "transmission", 0, 1, 0.01).name("transmission").onChange((v) => {
    for (const mat of textMats) mat.transmission = v;
  });
  txt.add(TEXT, "roughness", 0, 1, 0.01).name("roughness").onChange((v) => {
    for (const mat of textMats) mat.roughness = v;
  });
  txt.add(TEXT, "thickness", 0, 2, 0.01).name("thickness").onChange((v) => {
    for (const mat of textMats) mat.thickness = v;
  });
  txt.add(TEXT, "ior", 1, 2.5, 0.01).name("ior").onChange((v) => {
    for (const mat of textMats) mat.ior = v;
  });
  txt.addColor(TEXT, "color").name("tint").onChange((c) => {
    for (const mat of textMats) mat.color.fromArray(c.map((v) => v / 255));
  });

  // Surface & reflection controls.
  txt.add(TEXT, "clearcoat", 0, 1, 0.01).name("clearcoat").onChange((v) => {
    for (const mat of textMats) mat.clearcoat = v;
  });
  txt.add(TEXT, "clearcoatRoughness", 0, 1, 0.01).name("coat roughness").onChange((v) => {
    for (const mat of textMats) mat.clearcoatRoughness = v;
  });
  txt.add(TEXT, "reflectivity", 0, 1, 0.01).name("reflectivity").onChange((v) => {
    for (const mat of textMats) mat.reflectivity = v;
  });
  txt.add(TEXT, "specularIntensity", 0, 2, 0.01).name("specular").onChange((v) => {
    for (const mat of textMats) mat.specularIntensity = v;
  });
  txt.add(TEXT, "envMapIntensity", 0, 3, 0.01).name("env reflect").onChange((v) => {
    for (const mat of textMats) mat.envMapIntensity = v;
  });

  // Tinted-glass volume absorption.
  txt.addColor(TEXT, "attenuationColor").name("tint (volume)").onChange((c) => {
    for (const mat of textMats)
      mat.attenuationColor.fromArray(c.map((v) => v / 255));
  });
  txt.add(TEXT, "attenuationDistance", 0.05, 5, 0.05).name("tint depth").onChange((v) => {
    for (const mat of textMats) mat.attenuationDistance = v;
  });

  // Dispersion (prism fringes) and iridescence (thin-film sheen).
  txt.add(TEXT, "dispersion", 0, 5, 0.01).name("dispersion").onChange((v) => {
    for (const mat of textMats) mat.dispersion = v;
  });
  txt.add(TEXT, "iridescence", 0, 1, 0.01).name("iridescence").onChange((v) => {
    for (const mat of textMats) mat.iridescence = v;
  });
  txt.add(TEXT, "iridescenceIOR", 1, 2.5, 0.01).name("iridescence ior").onChange((v) => {
    for (const mat of textMats) mat.iridescenceIOR = v;
  });
  // txt.open();

  return gui;
};
