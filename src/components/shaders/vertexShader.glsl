varying vec2 vUv;

uniform float uTime;
uniform sampler2D uPerlinTexture;

#include ../includes/rotate2D.glsl

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);

    //? twist
    float twistPerlin = texture(
        uPerlinTexture, 
        vec2(0.5, uv.y * 0.15 - uTime * 0.004)
    ).r;
    float angle = twistPerlin * 10.0;

    vec2 newPosition = rotate2D(modelPosition.xz, angle);

    //? wind offset
    vec2 windOffset = vec2(
        texture(uPerlinTexture, vec2(0.3, uTime * 0.01)).r - 0.5, 
        texture(uPerlinTexture, vec2(0.15, uTime * 0.01)).r - 0.5
    );

    newPosition += windOffset * pow(uv.y, 2.0) * 2.0;

    modelPosition.xz = newPosition;

    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectionPosition = projectionMatrix * viewPosition;

    gl_Position = projectionPosition;

    vUv = uv;
}