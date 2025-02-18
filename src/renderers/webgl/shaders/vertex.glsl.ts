/*
    from https://github.com/antimatter15/splat/blob/main/main.js
*/

export const vertex = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

in vec3 aParticleSourcePosition;
in vec3 aParticlePosition;

uniform float uTime;

uniform highp usampler2D u_texture;
uniform mat4 projection, view;
uniform vec2 focal;
uniform vec2 viewport;

uniform bool u_useDepthFade;
uniform float u_depthFade;

uniform vec2 mouse;
uniform vec3 cameraPosition;
uniform bool clicked;
uniform vec3 rayDirection;

in vec2 position;
in int index;

out vec4 vColor;
out vec2 vPosition;

out float vTime;
out vec4 vTechPosition;
out vec2 vCenter;
out vec3 worldPosition;

out vec3 oParticlePosition;

float cubicPulse( float c, float w, float x ){
    x = abs(x - c);
    if( x>w ) return 0.000;
    x /= w;
    return 1.0
        - x*x*(3.000-2.0*x);
}

vec3 sub(vec3 a, vec3 b) {
    return vec3(a.x - b.x, a.y - b.y, a.z - b.z);
}

vec3 add(vec3 a, vec3 b) {
    return vec3(a.x + b.x, a.y + b.y, a.z + b.z);
}

bool intersect(vec3 rayPos, vec3 rayDir, vec3 spherePos, float sphereRadius) {
    // Step 1
    vec3 oc = sub(spherePos, rayPos);

    // Step 2
    float t = dot(oc, rayDir);

    // Step 3
    if (t < 0.0) return false;

    // Step 4
    float r2 = sphereRadius * sphereRadius;
    float oc2 = dot(oc, oc);
    float h2 = oc2 - t * t;

    // Step 5
    if (h2 > r2) return false;

    // Step 6
    float h = sqrt(r2 - h2);
    float t0 = t - h;
    float t1 = t + h;

    // Return the closest intersection point
    // return add(rayPos, rayDir * t0);
    return true;
}

void main () {

    oParticlePosition = aParticlePosition + aParticleSourcePosition;
    vTime = uTime;

    uvec4 cen = texelFetch(u_texture, ivec2((uint(index) & 0x3ffu) << 1, uint(index) >> 10), 0);
    worldPosition = vec3(uintBitsToFloat(cen.xyz));

    float value = (sin(vTime * 1.0) * 2.6) + 0.6;
    float size = 0.3;
    float zone = cubicPulse(value, size, worldPosition.y);

    if (zone > 0.01) {
        worldPosition.x += zone * 0.2 * sign(worldPosition.x);
        worldPosition.y += zone * 0.2 * sign(worldPosition.y);
    }

    //compute sphere around origin

    float radiusOrigin = 1.0;

    // compute sphere origin from mouse position

    vec3 sphereOrigin = vec3(0.0, 0.0, 0.0);

    //compute distance between world position and position of sphere origin

    float dist = length(worldPosition - sphereOrigin);

    bool inter = intersect(cameraPosition, rayDirection, worldPosition, 0.7);

    if (inter) {
        //compute vector between origin and camera position
        vec3 origin = vec3(0.0, 0.0, 0.0);
        vec3 v = cameraPosition - origin;

        v *= .5;

        //displace world position along vector

        worldPosition -= (radiusOrigin - dist) * v;

        //reduce displacement with time to go back to original position

        worldPosition += (radiusOrigin - dist) * v * (sin(0.5 * vTime)+1.0) / 2.0;
        // worldPosition.x *= (sin(0.8 * vTime)+1.0) / 2.0;
        // worldPosition.y *= (sin(0.8 * vTime)+1.0) / 2.0;
        // worldPosition.z *= (sin(0.8 * vTime)+1.0) / 2.0;
    }


    
    vec4 cam = view * vec4(worldPosition, 1);

    vec4 pos2d = projection * cam;

    float clip = 1.2 * pos2d.w;
    if (pos2d.z < -pos2d.w || pos2d.x < -clip || pos2d.x > clip || pos2d.y < -clip || pos2d.y > clip) {
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
        return;
    }


    uvec4 cov = texelFetch(u_texture, ivec2(((uint(index) & 0x3ffu) << 1) | 1u, uint(index) >> 10), 0);
    vec2 u1 = unpackHalf2x16(cov.x), u2 = unpackHalf2x16(cov.y), u3 = unpackHalf2x16(cov.z);
    mat3 Vrk = mat3(u1.x, u1.y, u2.x, u1.y, u2.y, u3.x, u2.x, u3.x, u3.y);

    mat3 J = mat3(
        focal.x / cam.z, 0., -(focal.x * cam.x) / (cam.z * cam.z), 
        0., -focal.y / cam.z, (focal.y * cam.y) / (cam.z * cam.z), 
        0., 0., 0.
    );

    mat3 T = transpose(mat3(view)) * J;
    mat3 cov2d = transpose(T) * Vrk * T;

    float mid = (cov2d[0][0] + cov2d[1][1]) / 2.0;
    float radius = length(vec2((cov2d[0][0] - cov2d[1][1]) / 2.0, cov2d[0][1]));
    float lambda1 = mid + radius, lambda2 = mid - radius;

    if(lambda2 < 0.0) return;
    vec2 diagonalVector = normalize(vec2(cov2d[0][1], lambda1 - cov2d[0][0]));
    vec2 majorAxis = min(sqrt(2.0 * lambda1), 1024.0) * diagonalVector;
    vec2 minorAxis = min(sqrt(2.0 * lambda2), 1024.0) * vec2(diagonalVector.y, -diagonalVector.x);

    vColor = vec4((cov.w) & 0xffu, (cov.w >> 8) & 0xffu, (cov.w >> 16) & 0xffu, (cov.w >> 24) & 0xffu) / 255.0;
    vPosition = position;

    float scalingFactor = 1.0;

    if(u_useDepthFade) {
        float depthNorm = (pos2d.z / pos2d.w + 1.0) / 2.0;
        float near = 0.1; float far = 100.0;
        float normalizedDepth = (2.0 * near) / (far + near - depthNorm * (far - near));
        float start = max(normalizedDepth - 0.1, 0.0);
        float end = min(normalizedDepth + 0.1, 1.0);
        scalingFactor = clamp((u_depthFade - start) / (end - start), 0.0, 1.0);
    }

    vec2 cent = vec2(pos2d);

    vec2 center = cent / pos2d.w;
    vCenter = center;
    gl_Position = vec4(
        center 
        + position.x * majorAxis * scalingFactor / viewport 
        + position.y * minorAxis * scalingFactor / viewport, 0.0, 1.0);

    vTechPosition = gl_Position;

}
`;
