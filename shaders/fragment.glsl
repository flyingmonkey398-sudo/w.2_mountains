#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_haziness;
uniform vec3 u_sunlightRGB;
uniform vec2 u_sunlightAngle;

// 2D Rotation
mat2 rot(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

// Complex Squaring (Your Iteration: z^2 + c)
vec2 complexSquare(vec2 z, vec2 c) {
    return vec2(z.x*z.x - z.y*z.y, 2.0 * z.x * z.y) + c;
}

// Fractal Noise from Your Julia Iteration (Formula 1)
float fractalNoise(vec2 p) {
    vec2 z = p;
    vec2 c = vec2(-0.8 + 0.156 * sin(u_time * 0.1), 0.0); // Dynamic c for animation
    int maxIter = 16;
    float escape = 0.0;
    for (int i = 0; i < maxIter; i++) {
        z = complexSquare(z, c);
        if (dot(z, z) > 4.0) {
            escape = float(i) / float(maxIter); // Normalized escape time
            break;
        }
    }
    return escape * 2.0 - 1.0; // -1 to 1 for height variation
}

// Domain Warping (From Your Sine/Cos Layers)
vec2 warp(vec2 p, float h) {
    float b = 0.1;
    return vec2(p.x + b * sin(h * 3.0), p.y + b * cos(h * 3.0));
}

// Layered Fractal Heightmap (fBm with Your Formulas 1+2)
float fractalHeight(vec2 p) {
    vec2 q = p;
    float h = 0.0;
    float amp = 1.0;
    float freq = 1.0;
    for (int k = 0; k < 5; k++) { // K=5 octaves
        vec2 warped = warp(q * freq, h); // Warping for mountains
        float noise = fractalNoise(warped); // Your iteration
        h += amp * noise;
        amp *= 0.5; // a^k
        freq *= 2.0;
    }
    // Add polynomial/sine base (from your paper)
    h += 0.5 * sin(p.x * 0.5 + u_time) + 0.3 * cos(p.y * 0.5 + u_time);
    return h * 2.0; // Scale for mountain height
}

// SDF for Terrain (Formula 3)
float sdf(vec3 p) {
    float h = fractalHeight(p.xz * 0.5 + vec2(u_time * 0.05)); // Scale/time for gentle animation
    return p.y - h; // Basic heightmap SDF
}

// Raymarching (Formula 4)
float raymarch(vec3 ro, vec3 rd) {
    float t = 0.0;
    for (int i = 0; i < 100; i++) {
        vec3 pos = ro + t * rd;
        float d = sdf(pos);
        if (d < 0.001) return t;
        t += max(d, 0.001);
        if (t > 50.0) break;
    }
    return -1.0; // No hit
}

// Simple Normal Estimation
vec3 normal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        sdf(p + e.xyy) - sdf(p - e.xyy),
        e.x,
        sdf(p + e.yxy) - sdf(p - e.yxy)
    ));
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
    uv *= 1.5; // FOV for landscape view
    
    vec3 ro = vec3(0.0, 5.0 + sin(u_time * 0.2), -10.0); // Camera above/back
    vec3 rd = normalize(vec3(uv, 1.5)); // Forward ray
    
    float t = raymarch(ro, rd);
    
    vec3 color;
    if (t > 0.0) {
        vec3 pos = ro + t * rd;
        vec3 n = normal(pos);
        
        // Sunlight (Formula 5: Placeholder angle; mouse will update)
        vec3 sunDir = normalize(vec3(cos(u_sunlightAngle.x), sin(u_sunlightAngle.y) * 0.5 + 0.5, sin(u_sunlightAngle.x)));
        float diff = max(0.0, dot(n, sunDir));
        
        // Mountain coloring: Height-based (gray/brown tones)
        float height = fractalHeight(pos.xz * 0.5);
        color = mix(vec3(0.3, 0.2, 0.1), vec3(0.6, 0.5, 0.4), smoothstep(0.0, 2.0, height));
        color *= (0.3 + 0.7 * diff); // Diffuse lighting
        color *= u_sunlightRGB; // RGB tint
    } else {
        color = vec3(0.4, 0.6, 0.8) * 0.5; // Sky blue
    }
    
    // Haziness Fog (Formula 5)
    if (t > 0.0) {
        float fogAmount = 1.0 - exp(-t * u_haziness);
        color = mix(color, vec3(0.5, 0.6, 0.7), fogAmount);
    }
    
    fragColor = vec4(color, 1.0);
}