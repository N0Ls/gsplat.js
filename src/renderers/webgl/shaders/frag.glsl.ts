/*
    from https://github.com/antimatter15/splat/blob/main/main.js
*/

export const frag = /* glsl */ `#version 300 es
precision highp float;

in vec4 vColor;
in vec2 vPosition;
in float vTime;
in vec4 vTechPosition;
in vec2 vCenter;
in vec3 worldPosition;

out vec4 fragColor;

float rand(vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

float rand2(float n){return fract(sin(n) * 43758.5453123);}

float cubicPulse( float c, float w, float x ){
    x = abs(x - c);
    if( x>w ) return 0.000;
    x /= w;
    return 1.0
        - x*x*(3.000-2.0*x);
}

void main () {
    float A = -dot(vPosition, vPosition);
    if (A < -4.0) discard;
    float B = exp(A) * vColor.a;
    vec4 originalColor = vec4(vColor.rgb * B, B);

    float value = (sin(vTime * 1.0) * 2.6) + 0.6;
    float size = 0.3;
    vec3 col = vec3(cubicPulse(value, size, worldPosition.y));
    
    vec4 alternateColor = vec4(vec3(0.0, 1.0, 0.0) * B, B);
    fragColor = mix(originalColor, alternateColor, col.x);
}
`;
