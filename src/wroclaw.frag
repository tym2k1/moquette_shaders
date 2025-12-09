#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_texture0;

// hash and noise
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 hash2(vec2 p) {
    return vec2(
        hash(p),
        hash(p + vec2(13.37, 7.11))
    );
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2  u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

const vec3 BACKGROUND_COLOR = vec3(0.1, 0.1, 0.1);
// grid + blobs
const vec3  FRONT_GRID_COLOR   = vec3(0.3, 0.3, 0.3);
const float FRONT_LINE_WIDTH  = 4.5;
const vec2  FRONT_GRID_SPACING = vec2(50.0, 50.0);
const float FRONT_ANGLE_X_DEG = -60.0;
const float FRONT_ANGLE_Y_DEG = -30.0;

const float FRONT_BLOB_RADIUS  = 1.0;
const float FRONT_BLOB_SPEED   = 0.1;
const int   FRONT_NUM_BLOBS    = 8;
const float FRONT_WIGGLE_SCALE = 200.0;

const vec3 FRONT_BLOB_COLOR_0 = vec3(1.0, 1.0, 0.0);
const vec3 FRONT_BLOB_COLOR_1 = vec3(0.0, 0.5, 1.0);
const vec3 FRONT_BLOB_COLOR_2 = vec3(1.0, 0.0, 0.0);

const float STRAND_RADIUS_FRAC       = 0.3;
const float STRAND_WIGGLE_FRAC       = 0.2;
const float STRAND_JITTER_FRAC       = 0.12;
const float STRAND_VARIANCE_SCALE    = 16.0;
const float STRAND_TONE_MIN          = 0.75;
const float STRAND_TONE_MAX          = 1.0;


float deg2rad(float d) { return d * 3.14159265359 / 180.0; }
vec2 rotateDeg(vec2 p, float degrees) {
    float a = deg2rad(degrees);
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c) * p;
}

float wigglyCircle(vec2 uv, vec2 pos, float radius, int variance, float wiggle_scale) {
    vec2 diff = uv - pos;
    float angle = atan(diff.y, diff.x);
    float rOffset = noise(vec2(cos(angle), float(variance) * 10.0 + sin(angle)) * 0.7 + u_time * 0.7) * wiggle_scale;
    float dist = length(diff);
    return smoothstep(radius + rOffset, radius + rOffset - 1.0, dist);
}


float strandMask(vec2 uvNorm, float cellScale) {
    // convert to pixel space for wigglyCircle
    vec2 uv = uvNorm * u_resolution;

    // cell index in normalized coords
    vec2 cellUV = uvNorm * cellScale;
    vec2 ip = floor(cellUV);

    // center in pixel coords (cell center)
    vec2 centerNorm = (ip + 0.5) / cellScale;
    vec2 center = centerNorm * u_resolution;

    // per-cell jitter (convert normalized fraction to pixels using cell size)
    vec2 cellSizePx = u_resolution / cellScale;
    float cellPx = min(cellSizePx.x, cellSizePx.y);
    vec2 rnd = hash2(ip + vec2(0.13, 0.37));
    // jitter as fraction of cell -> pixels
    vec2 jitterPixels = (rnd - 0.5) * (STRAND_JITTER_FRAC * cellPx);
    center += jitterPixels;

    // radius and wiggle scaled by cell pixel size
    float radius = cellPx * STRAND_RADIUS_FRAC;
    float wiggle_scale = cellPx * STRAND_WIGGLE_FRAC;

    // variance derived per-cell
    int variance = int(floor(hash(ip + vec2(0.7, 0.9)) * STRAND_VARIANCE_SCALE));

    // optional tone variation per-cell
    float micro = noise(ip * 0.37 + vec2(0.5, 0.5));
    float tone = mix(STRAND_TONE_MIN, STRAND_TONE_MAX, micro);

    // compute circle
    float m = wigglyCircle(uv, center, radius, variance, wiggle_scale);
    m *= tone;
    return clamp(m, 0.0, 1.0);
}

void main() {
    vec2 uv = gl_FragCoord.xy;

    vec2 uvX = rotateDeg(uv, FRONT_ANGLE_X_DEG);
    vec2 uvY = rotateDeg(uv, FRONT_ANGLE_Y_DEG);

    float distToVertical   = min(mod(uvX.x, FRONT_GRID_SPACING.x), FRONT_GRID_SPACING.x - mod(uvX.x, FRONT_GRID_SPACING.x));
    float distToHorizontal = min(mod(uvY.y, FRONT_GRID_SPACING.y), FRONT_GRID_SPACING.y - mod(uvY.y, FRONT_GRID_SPACING.y));
    float gridLineMask = float(distToVertical < FRONT_LINE_WIDTH || distToHorizontal < FRONT_LINE_WIDTH);

    vec3 color = vec3(0.6, 0.6, 0.6);
    color += FRONT_GRID_COLOR * gridLineMask;

    float cellScale = 110.0; // adjust to make circles larger or smaller (cells per axis)
    float sMask = strandMask(uv / u_resolution, cellScale);

    for (int i = 0; i < FRONT_NUM_BLOBS; i++) {
        vec2 blobPos = vec2(
            0.5 + 0.5 * sin(u_time * FRONT_BLOB_SPEED + float(i) * 2.0),
            0.5 + 0.5 * cos(u_time * FRONT_BLOB_SPEED + float(i) * 3.0)
        ) * u_resolution;

        float mask = wigglyCircle(uv, blobPos, FRONT_BLOB_RADIUS, i, 200.0);

        float idx = float(i);
        float m = mod(idx, 3.0);
        vec3 blobColor = (m < 0.5) ? FRONT_BLOB_COLOR_0 : (m < 1.5) ? FRONT_BLOB_COLOR_1 : FRONT_BLOB_COLOR_2;

        color = mix(color, blobColor, mask * gridLineMask);
    }

    color = mix(BACKGROUND_COLOR, color, sMask);
    gl_FragColor = vec4(color, 1.0);
}
