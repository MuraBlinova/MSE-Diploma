precision highp float;

uniform sampler2D textureSampler;
varying vec2 vUV;
void main() {
    gl_FragColor = texture2D(textureSampler, vUV);
}