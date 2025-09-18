#version 300 es
precision highp float;
out vec4 fragColor;

uniform float uTime;
uniform vec2  uResolution;

/* Scene controls (wired via JS/CSS) */
uniform float uHaziness;     // [0..1]
uniform vec3  uSunDir;       // normalized sun direction
uniform vec3  uRGB;          // RGB tint (0..1)

/* -----------------------------------------------------------
   Math building blocks: hash → noise → fbm → ridge → warp
   These follow standard, well-known formulations used in
   terrain synthesis and match the formulas shown on-page.
   ----------------------------------------------------------- */

/* 1) Hash (value hashing for grid points) */
float hash(vec2 p) {
  // Low-cost hash; 2D → 1D
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

/* 2) Value noise with smooth interpolation */
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  float a = hash(i + vec2(0.0, 0.0));
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  // Quintic smoothstep (C2)
  vec2 u = f*f*f*(f*(f*6.0 - 15.0) + 10.0);

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

/* 3) fBM: sum of octave noise with lacunarity (f) and gain (g) */
float fbm(vec2 p, int octaves, float f, float g) {
  float amp = 0.5;
  float sum = 0.0;
  for (int i = 0; i < 12; ++i) {
    if (i >= octaves) break;
    sum += amp * noise(p);
    p *= f;
    amp *= g;
  }
  return sum;
}

/* 4) Ridged fBM component */
float ridge(float x) {
  // maps [0,1] noise to a "ridge" shape also in [0,1]
  return 1.0 - abs(2.0 * x - 1.0);
}

float fbmRidge(vec2 p, int octaves, float f, float g) {
  float amp = 0.5;
  float sum = 0.0;
  for (int i = 0; i < 12; ++i) {
    if (i >= octaves) break;
    sum += amp * ridge(noise(p));
    p *= f;
    amp *= g;
  }
  return sum;
}

/* 5) Domain warp (optional richness) */
vec2 warp(vec2 p, float w, float fw, int oct, float f, float g) {
  float wv = fbm(p * fw, oct, f, g);
  return p + w * vec2(wv, wv);
}

/* 6) Heightfield from fBM (scalable) */
float terrainHeight(vec2 xz) {
  // Tunables (will expose later via UI)
  const int   OCT = 6;
  const float LAC = 2.0;   // lacunarity (frequency multiplier)
  const float GAIN= 0.5;   // gain (amplitude multiplier)
  const float SCALE = 1.5; // input scale for world size
  const float AMP   = 1.2; // overall amplitude

  vec2 p = xz * SCALE;

  // Optional: domain warp for interest
  p = warp(p, 0.35, 0.7, 4, 2.0, 0.5);

  float h = fbm(p, OCT, LAC, GAIN);
  // Blend in a small ridged component for peaks
  h += 0.25 * fbmRidge(p * 1.6, 4, 2.0, 0.5);

  return AMP * (h * 2.0 - 1.0); // center around 0
}

/* 7) Normal from height (finite differences) */
vec3 heightNormal(vec2 xz) {
  float eps = 0.001;
  float h  = terrainHeight(xz);
  float hx = terrainHeight(xz + vec2(eps, 0.0));
  float hz = terrainHeight(xz + vec2(0.0, eps));
  vec3 n = normalize(vec3(-(hx - h)/eps, 1.0, -(hz - h)/eps));
  return n;
}

/* -----------------------------------------------------------
   Minimal fragment main: currently renders black.
   This keeps the page "empty" but with all plumbing wired.
   Turn on shading later by sampling terrainHeight/normal.
   ----------------------------------------------------------- */

void main() {
  // Placeholder clear (kept black on purpose)
  vec2 uv = gl_FragCoord.xy / uResolution;
  // Example: tint + subtle haze just to verify uniforms are live.
  // Commented out to preserve a truly "empty" visual.
  // vec3 col = mix(vec3(0.0), uRGB, 0.0);
  // fragColor = vec4(col, 1.0);

  fragColor = vec4(0.0, 0.0, 0.0, 1.0);
}
