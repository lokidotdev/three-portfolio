precision highp float;

varying vec2 vUv;

uniform sampler2D uTexture;
uniform float uTime;
uniform float uHover;      // 0..1 smoothed hover amount
uniform vec2  uMouse;      // pointer position in plane uv (0..1)
uniform float uTexAspect;  // texture width / height
uniform float uScreenAspect;
uniform vec2  uMoveDir;    // smoothed direction of mouse movement (unit vector, uv space)

// --- Intro reveal ---
uniform float uIntro;        // 0 = hidden, 1 = fully in view (>=1 disables the reveal)
uniform float uIntroStagger; // left->right stagger spread (0 = together, 1 = sequential)
uniform float uIntroSlide;   // how far (texture-uv) glyphs start below the clip line
uniform float uTextMaskLine; // texture-uv.y of the bottom clip line (text baseline)
uniform float uTextMaskTop;  // texture-uv.y of the top clip line (cap line)
uniform float uExit;         // 0 = in place, 1 = staggered up & out (focus transition)
uniform float uExitSlide;    // how far (texture-uv) glyphs travel up to clear the top line

// --- Tunable effect params (driven by dat.GUI) ---
uniform float uStrength;      // master multiplier for the displacement
uniform float uRippleStrength;
uniform float uPushStrength;
uniform float uCAStrength;
uniform float uGlowStrength;
uniform float uWaveFreq;
uniform float uWaveSpeed;
uniform float uFalloff;
uniform float uRadius;        // overall size of the distorted area
uniform float uSpreadAlong;   // reach along the movement axis (1 = circular)
uniform float uSpreadAcross;  // reach perpendicular to it (1 = circular)
uniform vec3  uGlowColor;

// Cover-fit the texture over the viewport: fill the whole screen without
// stretching, cropping the overflowing axis (like CSS object-fit: cover).
vec2 fitUv(vec2 uv) {
  vec2 scale = vec2(1.0);
  if (uScreenAspect > uTexAspect) {
    scale.y = uTexAspect / uScreenAspect;
  } else {
    scale.x = uScreenAspect / uTexAspect;
  }
  return (uv - 0.5) * scale + 0.5;
}

void main() {
  vec2 puv = vUv;

  // Offset from the pointer (aspect-corrected so shape is measured on screen).
  vec2 delta = puv - uMouse;
  vec2 aspectDelta = vec2(delta.x * uScreenAspect, delta.y);

  // Build a basis aligned with the movement: one axis along it, one across.
  vec2 axis = normalize(uMoveDir + vec2(1e-6, 0.0));
  vec2 perp = vec2(-axis.y, axis.x);
  float along = dot(aspectDelta, axis);
  float across = dot(aspectDelta, perp);

  // Anisotropic distance: stretch the falloff along the movement axis and
  // squeeze it across, so the influence is an ellipse (1,1 = circular).
  // uRadius scales the whole ellipse to grow/shrink the affected area.
  float dist = length(vec2(
    along / (uSpreadAlong * uRadius),
    across / (uSpreadAcross * uRadius)
  ));

  float influence = exp(-dist * uFalloff);
  vec2 dir = uMoveDir;

  // Ripple: a travelling wave riding along the movement axis.
  float wave = sin(dist * uWaveFreq - uTime * uWaveSpeed) * influence;
  float ripple = wave * uRippleStrength * uHover * uStrength;

  // Push the pixels ahead in the direction of movement.
  float push = influence * uPushStrength * uHover * uStrength;

  puv += dir * ripple;
  puv -= dir * push;

  // Chromatic aberration splits along the movement direction near the cursor.
  float ca = uCAStrength * influence * uHover;
  vec2 caOff = dir * ca;

  // --- Intro reveal: the hero text rises into view behind a fixed clip line at
  // its baseline, with a left->right stagger. Each column has its own progress
  // (left finishes first); glyphs start slid below the line (sampled from above,
  // i.e. off the text) and everything under the line is masked, so they appear
  // to rise up out of a hidden edge. uIntro >= 1 disables it (normal running). ---
  vec2 restUv = fitUv(puv);
  float col = clamp(restUv.x, 0.0, 1.0);

  // Load-in: each column rises from below the baseline into view (uIntro 0->1).
  float cpIn = clamp(uIntro * (1.0 + uIntroStagger) - col * uIntroStagger, 0.0, 1.0);
  cpIn = smoothstep(0.0, 1.0, cpIn);
  float shiftIn = (1.0 - cpIn) * uIntroSlide; // +y: sample from above -> glyph sits lower

  // Focus exit: the same stagger, sliding up and out through the top clip line
  // as a panel straightens (uExit 0->1); reverses back on return home.
  float cpOut = clamp(uExit * (1.0 + uIntroStagger) - col * uIntroStagger, 0.0, 1.0);
  cpOut = smoothstep(0.0, 1.0, cpOut);
  float shiftOut = -cpOut * uExitSlide; // -y: sample from below -> glyph rides up

  vec2 introShift = vec2(0.0, shiftIn + shiftOut);

  // Overflow-hidden clip between the baseline and cap line, so glyphs appear to
  // emerge from / vanish behind a fixed edge. Only while a transition runs, so
  // the mouse distortion isn't clipped in the resting state.
  float masking = max(step(uIntro, 0.9999), step(0.0001, uExit));
  float clip = step(uTextMaskLine, restUv.y) * step(restUv.y, uTextMaskTop);
  float introMask = mix(1.0, clip, masking);

  vec2 uvR = fitUv(puv + caOff) + introShift;
  vec2 uvG = restUv + introShift;
  vec2 uvB = fitUv(puv - caOff) + introShift;

  float r = texture2D(uTexture, uvR).r;
  float g = texture2D(uTexture, uvG).g;
  float b = texture2D(uTexture, uvB).b;
  // Texture alpha drives compositing (the artwork is transparent outside text).
  float a = texture2D(uTexture, uvG).a * introMask;

  vec3 texColor = vec3(r, g, b);

  // Letterbox anything sampled outside the texture (treat as background).
  vec2 c = fitUv(puv);
  float inside = step(0.0, c.x) * step(c.x, 1.0) * step(0.0, c.y) * step(c.y, 1.0);

  // Composite the artwork over a white canvas using its alpha, so the empty
  // (transparent) areas show white instead of the texture's dark RGB.
  vec3 color = mix(vec3(1.0), texColor, a * inside);

  // Subtle neon glow lift around the pointer for extra punch.
  color += uGlowColor * push * uGlowStrength * inside;

  gl_FragColor = vec4(color, 1.0);
}
