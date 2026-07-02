varying vec2 vUv;

uniform sampler2D uPerlinTexture;
uniform float uTime;

void main() {
    vec2 smokeUv = vUv;
    smokeUv.x *= 0.5;
    smokeUv.y *= 0.5;

    smokeUv.y -= uTime * 0.03;

    float smoke = texture(uPerlinTexture, smokeUv).r;

    //? infinte smoke
    smoke = smoothstep(0.4, 1.0, smoke);

    //? ease from left and right
    smoke *= smoothstep(0.0, 0.2, vUv.x);
    smoke *= smoothstep(1.0, 0.8, vUv.x);
    
    //? ease from top and bottom
    smoke *= smoothstep(0.0, 0.2, vUv.y);
    smoke *= smoothstep(1.0, 0.8, vUv.y);

    gl_FragColor = vec4(0.6, 0.3, 0.2, smoke);
    // gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>

}