// WebGL 2.0 Setup
const canvas = document.getElementById('glCanvas');
const errorOverlay = document.getElementById('errorOverlay');
const gl = canvas.getContext('webgl2');
if (!gl) {
    console.error('WebGL 2.0 not supported. Try enabling it in browser settings or use a modern browser.');
    errorOverlay.style.display = 'block';
    errorOverlay.innerHTML = 'WebGL 2.0 Required for Shaders<br><small>Update browser or check console.</small>';
    throw new Error('WebGL 2.0 not supported');
}

// Fixed medium size
canvas.width = 800;
canvas.height = 600;
gl.viewport(0, 0, canvas.width, canvas.height);

// Load Shaders (Expects: type, sourceOrUrl — gl is global)
async function loadShader(type, sourceOrUrl) {
    console.log(`loadShader called with type: ${type} (${typeof type}), sourceOrUrl: ${sourceOrUrl} (${typeof sourceOrUrl})`); // Debug param types

    let source;
    const isUrl = typeof sourceOrUrl === 'string' && (sourceOrUrl.startsWith('./') || sourceOrUrl.startsWith('shaders/'));

    if (isUrl) {
        // Fetch from file
        try {
            const response = await fetch(sourceOrUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText} (File missing? Create ${sourceOrUrl})`);
            }
            source = await response.text();
            console.log(`Loaded shader from ${sourceOrUrl} (length: ${source.length})`);
        } catch (err) {
            console.error(`Fetch failed for ${sourceOrUrl}:`, err);
            return null;
        }
    } else {
        // Inline source (must be string)
        source = sourceOrUrl;
        console.log('Using inline shader source (length:', source ? source.length : 'undefined', ')');
    }

    // Type Check: Ensure source is a string before proceeding
    if (typeof source !== 'string') {
        console.error('Shader source is not a string (type:', typeof source, 'value:', source, ') — check file/copy-paste.');
        return null;
    }

    // Now safe to trim
    source = source.trim();
    if (source === '') {
        console.error('Empty shader source after trim');
        return null;
    }

    const shader = gl.createShader(type);
    if (!shader) {
        throw new Error(`Failed to create shader of type ${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'}`);
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        console.error(`Shader ${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} compile error:\n${log}\nSource preview (first 200 chars):\n${source.substring(0, 200)}...`);
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

// Vertex Shader Source (Inline with Backticks for Safety)
const vertexShaderSource = `#version 300 es
in vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// Fallback Fragment Shader (Simple Animated Gradient)
const fallbackFragmentSource = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 u_resolution;
uniform float u_time;
void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec3 color = 0.5 + 0.5 * cos(u_time + uv.xyx + vec3(0, 2, 4));
    fragColor = vec4(color, 1.0);
}`;

// Program Setup (Fixed Calls: No Extra 'gl' Param)
async function initProgram() {
    try {
        // Load Vertex (Inline — Fixed Call)
        const vs = await loadShader(gl.VERTEX_SHADER, vertexShaderSource);
        if (!vs) throw new Error('Vertex shader failed to load/compile');

        // Load Fragment (Fetch with Fallback — Fixed Calls)
        let fs = await loadShader(gl.FRAGMENT_SHADER, 'shaders/fragment.glsl');
        if (!fs) {
            console.warn('Fragment file failed (missing or invalid?)—using fallback gradient. Add shaders/fragment.glsl for full fractal mountains.');
            fs = await loadShader(gl.FRAGMENT_SHADER, fallbackFragmentSource);
        }
        if (!fs) throw new Error('Fragment shader failed (even fallback)—check console.');

        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(program);
            console.error('Program link error:', log);
            gl.deleteProgram(program);
            return null;
        }

        // Cleanup
        gl.detachShader(program, vs);
        gl.detachShader(program, fs);
        gl.deleteShader(vs);
        gl.deleteShader(fs);

        console.log('Shaders compiled and linked successfully');
        return program;
    } catch (error) {
        console.error('Shader init error:', error);
        errorOverlay.style.display = 'block';
        errorOverlay.innerHTML += '<br><small>' + error.message + '</small>';
        return null;
    }
}

// Quad Buffer
const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

let program = null;
let positionLoc = null;
let resolutionLoc, timeLoc, hazinessLoc, sunlightRGBLoc, sunlightAngleLoc = null;

async function setup() {
    try {
        program = await initProgram();
        if (!program) {
            console.error('Failed to initialize program');
            return false;
        }

        gl.useProgram(program);

        positionLoc = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

        // Get Uniform Locations (Safe: Null if not present in fallback)
        resolutionLoc = gl.getUniformLocation(program, 'u_resolution');
        timeLoc = gl.getUniformLocation(program, 'u_time');
        hazinessLoc = gl.getUniformLocation(program, 'u_haziness');
        sunlightRGBLoc = gl.getUniformLocation(program, 'u_sunlightRGB');
        sunlightAngleLoc = gl.getUniformLocation(program, 'u_sunlightAngle');

        return true;
    } catch (error) {
        console.error('Setup error:', error);
        return false;
    }
}

function setUniforms() {
    if (!program || !resolutionLoc) return;
    if (resolutionLoc) gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
    if (timeLoc) gl.uniform1f(timeLoc, performance.now() / 1000.0);

    const root = getComputedStyle(document.documentElement);
    const haziness = parseFloat(root.getPropertyValue('--haziness')) || 0.05;
    const sunlightRGBStr = root.getPropertyValue('--sunlight-rgb') || '1,0.9,0.7';
    const sunlightRGB = sunlightRGBStr.trim().split(',').map(Number);
    if (hazinessLoc) gl.uniform1f(hazinessLoc, haziness);
    if (sunlightRGBLoc) gl.uniform3fv(sunlightRGBLoc, new Float32Array(sunlightRGB));
    if (sunlightAngleLoc) gl.uniform2f(sunlightAngleLoc, 0.0, 0.0); // Placeholder
}

// Render Loop
function render() {
    if (!program) return;
    setUniforms();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
}

// Init (With Try-Catch for Uncaught Promises)
(async () => {
    try {
        const success = await setup();
        if (success) {
            errorOverlay.style.display = 'none';
            render();
            console.log('Project initialized successfully—check canvas!');
        } else {
            console.error('Setup failed—check shaders/files.');
            errorOverlay.style.display = 'block';
        }
    } catch (error) {
        console.error('Init error:', error);
        errorOverlay.style.display = 'block';
        errorOverlay.innerHTML += '<br><small>' + error.message + '</small>';
    }
})();

// Future: Mouse & Sliders (Uncomment When Ready)
// canvas.addEventListener('mousemove', (e) => { ... });
// document.getElementById('hazinessSlider').addEventListener('input', (e) => { ... });