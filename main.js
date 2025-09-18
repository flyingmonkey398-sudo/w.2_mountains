// WebGL Setup for GLSL Shader
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
if (!gl) {
    console.error('WebGL not supported');
    throw new Error('WebGL not supported');
}

// Resize canvas to full screen
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Shader Sources (Load from files; placeholders for now)
const vertexShaderSource = `#version 300 es
in vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// Fragment Shader Template (Implement your fractal here)
const fragmentShaderSource = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_haziness; // Future: 0.0-0.1 from slider
uniform vec3 u_sunlightRGB; // Future: From RGB sliders
uniform vec2 u_sunlightAngle; // Future: From mouse (e.g., atan2(mouseY, mouseX))

// Placeholder SDF (Replace with your paper/video formulas, e.g., fractal terrain)
float sdf(vec3 p) {
    // Example: Simple plane + noise (extend to Quilez-style raymarch)
    return p.y - 0.5 * sin(p.x * 5.0 + u_time) * sin(p.z * 5.0 + u_time); // Fractal-like height
}

// Raymarching function (From Quilez's style)
vec3 raymarch(vec3 ro, vec3 rd) {
    float t = 0.0;
    for (int i = 0; i < 100; i++) { // maxSteps
        vec3 pos = ro + t * rd;
        float d = sdf(pos);
        if (d < 0.001) break;
        t += d;
        if (t > 20.0) break; // maxDist
    }
    return ro + t * rd;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
    vec3 ro = vec3(0.0, 0.0, -3.0); // Ray origin
    vec3 rd = normalize(vec3(uv, 1.0)); // Ray direction
    
    vec3 pos = raymarch(ro, rd);
    
    // Placeholder color (Add normal/lighting; use u_sunlightAngle for sunDir)
    vec3 color = vec3(0.2 + 0.8 * pos.y, 0.5 + 0.5 * pos.x, 0.3); // Simple gradient
    
    // Haziness fog (Formula visualized in HTML)
    float fog = exp(-length(pos) * u_haziness);
    color = mix(vec3(0.5), color, fog);
    
    // Sunlight tint (Future mouse-driven)
    color *= u_sunlightRGB;
    
    fragColor = vec4(color, 1.0);
}`;

// Compile Shader Helper
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Program Setup
const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
const program = gl.createProgram();
gl.attachShader(program, vs);
gl.attachShader(program, fs);
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    throw new Error('Program link error');
}
gl.useProgram(program);

// Quad Vertices (For full-screen shader)
const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

const positionLoc = gl.getAttribLocation(program, 'a_position');
gl.enableVertexAttribArray(positionLoc);
gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

// Uniform Locations (For future vars)
const resolutionLoc = gl.getUniformLocation(program, 'u_resolution');
const timeLoc = gl.getUniformLocation(program, 'u_time');
const hazinessLoc = gl.getUniformLocation(program, 'u_haziness');
const sunlightRGBLoc = gl.getUniformLocation(program, 'u_sunlightRGB');
const sunlightAngleLoc = gl.getUniformLocation(program, 'u_sunlightAngle');

// Set Initial Uniforms (Tie to CSS vars for now; sliders will override)
function setUniforms() {
    gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
    gl.uniform1f(timeLoc, performance.now() / 1000.0);
    
    // From CSS vars (Future: Update via sliders/mouse)
    const root = getComputedStyle(document.documentElement);
    const haziness = parseFloat(root.getPropertyValue('--haziness'));
    const sunlightRGB = root.getPropertyValue('--sunlight-rgb').trim().split(',').map(Number);
    gl.uniform1f(hazinessLoc, haziness);
    gl.uniform3fv(sunlightRGBLoc, new Float32Array(sunlightRGB));
    gl.uniform2f(sunlightAngleLoc, 0.0, 0.0); // Placeholder; mouse will set
}

// Render Loop
function render() {
    setUniforms();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
}
render();

// Future: Slider Setup (Uncomment/Add HTML sliders later)
// Example: document.getElementById('hazinessSlider').addEventListener('input', (e) => {
//     gl.uniform1f(hazinessLoc, e.target.value);
//     document.documentElement.style.setProperty('--haziness', e.target.value);
//     // Trigger re-render if needed (but loop handles it)
// });

// Future: Mouse Tracking for Sunlight Angle
// canvas.addEventListener('mousemove', (e) => {
//     const rect = canvas.getBoundingClientRect();
//     const x = (e.clientX - rect.left) / rect.width * 2 - 1;
//     const y = (e.clientY - rect.top) / rect.height * 2 - 1;
//     const angle = Math.atan2(y, x);
//     gl.uniform1f(sunlightAngleLoc, angle, 0.0); // Update in loop
// });