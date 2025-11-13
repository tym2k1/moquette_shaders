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

// strand generation
float distLine(vec2 a, vec2 b){
    b = a - b;
    float h = clamp(dot(a, b) / dot(b, b), 0.0, 1.0);
    return length(a - b*h);
}

float strandMask(vec2 uv, float cellScale){
    // procedural cell scaling
    vec2 p = uv * cellScale * 1000.0;

    // animate the position over time
    p += vec2(u_time * 0.2, u_time * 0.2); // tweak speed

    vec2 ip = floor(p);
    p -= ip;

    float mask = 0.0;
    for (int j = -3; j <= 3; j++) {
        for (int i = -3; i <= 3; i++) {
            vec2 o = vec2(float(i), float(j));
            o += (hash2(o + ip) - vec2(0.5)) * 2.0;

            float alpha = 1.0;
            float layer = 0.0;

            const int lNum = 6;
            for (int n = 0; n < lNum; n++) {
                float a = texture2D(u_texture0, (ip + o) / (cellScale * 50.0)).x;
                const float rl = 2.5 / 12.0;
                vec2 r = vec2(cos(a), sin(a)) * rl / cellScale;
                float l = distLine(o - p, o + r - p);
                float strandWidth = 0.15 / cellScale;
                l = 1.0 - smoothstep(0.0, strandWidth, l);
                l *= alpha * (1.0 - alpha) * 0.8;
                layer = max(layer, l);
                o += r;
                alpha -= 1.0 / float(lNum);
            }
            mask += layer;
        }
    }

    mask = dot(vec3(mask), vec3(0.4, 0.4, 0.4));
    mask = sqrt(max(mask, 0.0));
    return mask;
}
// grid + blobs
const vec3 GRID_COLOR   = vec3(0.2, 0.2, 0.2);
const float LINE_WIDTH  = 4.5;
const vec2 GRID_SPACING = vec2(50.0, 50.0);
const float ANGLE_X_DEG = -60.0;
const float ANGLE_Y_DEG = -30.0;

const float BLOB_RADIUS  = 1.0;
const float BLOB_SPEED   = 0.1;
const int   NUM_BLOBS    = 8;
const float WIGGLE_SCALE = 200.0;

const vec3 BLOB_COLOR_0 = vec3(1.0, 1.0, 0.0);
const vec3 BLOB_COLOR_1 = vec3(0.0, 0.5, 1.0);
const vec3 BLOB_COLOR_2 = vec3(1.0, 0.0, 0.0);

float deg2rad(float d) { return d * 3.14159265359 / 180.0; }
vec2 rotateDeg(vec2 p, float degrees) {
    float a = deg2rad(degrees);
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c) * p;
}

float wigglyCircle(vec2 uv, vec2 pos, float radius, int variance) {
    vec2 diff = uv - pos;
    float angle = atan(diff.y, diff.x);
    float rOffset = noise(vec2(cos(angle), float(variance) * 10.0 + sin(angle)) * 0.7 + u_time * 0.7) * WIGGLE_SCALE;
    float dist = length(diff);
    return smoothstep(radius + rOffset, radius + rOffset - 1.0, dist);
}

void main() {
    vec2 uv = gl_FragCoord.xy;

    vec2 uvX = rotateDeg(uv, ANGLE_X_DEG);
    vec2 uvY = rotateDeg(uv, ANGLE_Y_DEG);

    float distToVertical   = min(mod(uvX.x, GRID_SPACING.x), GRID_SPACING.x - mod(uvX.x, GRID_SPACING.x));
    float distToHorizontal = min(mod(uvY.y, GRID_SPACING.y), GRID_SPACING.y - mod(uvY.y, GRID_SPACING.y));
    float gridLineMask = float(distToVertical < LINE_WIDTH || distToHorizontal < LINE_WIDTH);

    vec3 color = vec3(0.5, 0.5, 0.5);
    color += GRID_COLOR * gridLineMask;

    float cellScale = 0.5; // adjust to make strands larger or smaller
    float sMask = strandMask(uv / u_resolution, cellScale);

    for (int i = 0; i < NUM_BLOBS; i++) {
        vec2 blobPos = vec2(
            0.5 + 0.5 * sin(u_time * BLOB_SPEED + float(i) * 2.0),
            0.5 + 0.5 * cos(u_time * BLOB_SPEED + float(i) * 3.0)
        ) * u_resolution;

        float mask = wigglyCircle(uv, blobPos, BLOB_RADIUS, i);

        float idx = float(i);
        float m = mod(idx, 3.0);
        vec3 blobColor = (m < 0.5) ? BLOB_COLOR_0 : (m < 1.5) ? BLOB_COLOR_1 : BLOB_COLOR_2;

        color = mix(color, blobColor, mask * gridLineMask);
    }

    color *= sMask;
    gl_FragColor = vec4(color, 1.0);
}
