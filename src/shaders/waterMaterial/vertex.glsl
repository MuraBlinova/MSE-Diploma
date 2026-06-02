precision highp float;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 world;
uniform mat4 worldViewProjection;

uniform sampler2D heightMap;
uniform sampler2D displacementMap;
uniform sampler2D heightMap1;
uniform sampler2D displacementMap1;
uniform sampler2D heightMap2;
uniform sampler2D displacementMap2;
uniform sampler2D heightMap3;
uniform sampler2D displacementMap3;
uniform sampler2D wangSpectraMap;

uniform mat3 uTiles;
uniform mat3 uAmps;
uniform float showHexlMixing;
uniform float uGridStep;
uniform float uBlendSigma;
uniform float uLODSkip;
uniform float showPerlinNoise;
uniform float uPerlinStrength;
uniform float useWangTiles;
uniform float wangMapWidth;
uniform float wangMapHeight;
uniform float wangPadding;

varying vec3 vNormalW;
varying vec3 vPositionW;
varying vec4 vPositionClip;
varying vec2 vUV;
varying vec2 vTileUV0;
varying vec2 vTileUV1;
varying vec2 vTileUV2;
varying vec2 vWangXZ;
varying vec2 vWorldXZ;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rand(vec2 n) { return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }

float perlinNoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float a = rand(i), b = rand(i + vec2(1.0, 0.0)), c = rand(i + vec2(0.0, 1.0)), d = rand(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float getWeight(vec2 worldXZ, float seed) {
    float L = uGridStep; float slope = sqrt(3.0);
    float m = (worldXZ.x / L + worldXZ.y / (L * slope)) / 2.0;
    float n = (worldXZ.x / L - worldXZ.y / (L * slope)) / 2.0;
    float m0 = floor(m), n0 = floor(n);
    vec2 node0, node1, node2;
    if (m - m0 > n - n0) {
        node0 = vec2((m0 + n0) * L, (m0 - n0) * L * slope / 2.0);
        node1 = vec2((m0 + 1.0 + n0) * L, (m0 + 1.0 - n0) * L * slope / 2.0);
        node2 = vec2((m0 + 1.0 + n0 + 1.0) * L, (m0 + 1.0 - n0 - 1.0) * L * slope / 2.0);
    } else {
        node0 = vec2((m0 + n0) * L, (m0 - n0) * L * slope / 2.0);
        node1 = vec2((m0 + 1.0 + n0 + 1.0) * L, (m0 + 1.0 - n0 - 1.0) * L * slope / 2.0);
        node2 = vec2((m0 + n0 + 1.0) * L, (m0 - n0 - 1.0) * L * slope / 2.0);
    }
    float h0 = fract(hash(node0) + seed), h1 = fract(hash(node1) + seed), h2 = fract(hash(node2) + seed);
    float d0 = length(worldXZ - node0), d1 = length(worldXZ - node1), d2 = length(worldXZ - node2);
    float sigma = uGridStep * uBlendSigma;
    float w0 = 1.0 / (1.0 + exp((d0 - sigma) / (sigma * 0.25)));
    float w1 = 1.0 / (1.0 + exp((d1 - sigma) / (sigma * 0.25)));
    float w2 = 1.0 / (1.0 + exp((d2 - sigma) / (sigma * 0.25)));
    float total = w0 + w1 + w2;

    float raw = (h0 * w0 + h1 * w1 + h2 * w2) / total;
    float minWeight = 0.0;
    float maxWeight = 1.0;
    return minWeight + raw * (maxWeight - minWeight);
}

float sampleHeightOctave(int octave, vec2 worldXZ, float tileSize) {
    vec2 texUV = fract(worldXZ / tileSize);
    if (octave >= 9) return texture2D(heightMap3, texUV).r;
    if (octave >= 6) return texture2D(heightMap2, texUV).r;
    if (octave >= 3) return texture2D(heightMap1, texUV).r;
    return texture2D(heightMap, texUV).r;
}

vec2 sampleDisplacementOctave(int octave, vec2 worldXZ, float tileSize) {
    vec2 texUV = fract(worldXZ / tileSize);
    if (octave >= 9) return texture2D(displacementMap3, texUV).rg;
    if (octave >= 6) return texture2D(displacementMap2, texUV).rg;
    if (octave >= 3) return texture2D(displacementMap1, texUV).rg;
    return texture2D(displacementMap, texUV).rg;
}

vec4 getWangWeights(vec2 worldXZ) {
    float halfWaterSize = 50.0;
    float adjustedX = worldXZ.x + halfWaterSize;
    float adjustedZ = worldXZ.y + halfWaterSize;
    
    float rawX = adjustedX / uGridStep;
    float rawZ = adjustedZ / uGridStep;
    float localX = rawX - floor(rawX);
    float localZ = rawZ - floor(rawZ);
    
    float tileX = floor(rawX);
    float tileZ = floor(rawZ);
    
    if (localX > 0.999) {
        tileX -= 1.0;
        localX = 0.0;
    }
    if (localZ > 0.999) {
        tileZ -= 1.0;
        localZ = 0.0;
    }

    if (localX < 0.001) localX = 1.0;
    if (localZ < 0.001) localZ = 1.0;
    
    float mapW = wangMapWidth / wangPadding;
    float mapH = wangMapHeight / wangPadding;
    tileX = mod(tileX, mapW);
    tileZ = mod(tileZ, mapH);
    if (tileX < 0.0) tileX += mapW;
    if (tileZ < 0.0) tileZ += mapH;
    
    vec2 mapUV = vec2(
        (tileX * wangPadding + wangPadding * 0.5) / wangMapWidth,
        (tileZ * wangPadding + wangPadding * 0.5) / wangMapHeight
    );
    vec4 spectra = texture2D(wangSpectraMap, mapUV) * 255.0;
    
    float specTop = clamp(floor(spectra.x + 0.5), 0.0, 3.0);
    float specRight = clamp(floor(spectra.y + 0.5), 0.0, 3.0);
    float specBottom = clamp(floor(spectra.z + 0.5), 0.0, 3.0);
    float specLeft = clamp(floor(spectra.w + 0.5), 0.0, 3.0);
    
    float u = localX, v = localZ;
    float dTop = v, dRight = 1.0 - u, dBottom = 1.0 - v, dLeft = u;
    
    float sigma = 0.15;
    float wTop = exp(-dTop * dTop / (2.0 * sigma * sigma));
    float wRight = exp(-dRight * dRight / (2.0 * sigma * sigma));
    float wBottom = exp(-dBottom * dBottom / (2.0 * sigma * sigma));
    float wLeft = exp(-dLeft * dLeft / (2.0 * sigma * sigma));
    
    float totalW = wTop + wRight + wBottom + wLeft;
    float edgeInfluence = min(1.0, totalW * 50.0);
    float neutralInfluence = 1.0 - edgeInfluence;
    float avgWeight = 0.25;
    
    float fTop = (wTop / totalW) * edgeInfluence + avgWeight * neutralInfluence;
    float fRight = (wRight / totalW) * edgeInfluence + avgWeight * neutralInfluence;
    float fBottom = (wBottom / totalW) * edgeInfluence + avgWeight * neutralInfluence;
    float fLeft = (wLeft / totalW) * edgeInfluence + avgWeight * neutralInfluence;
    
    float totalF = fTop + fRight + fBottom + fLeft;
    if (totalF > 0.0001) { fTop /= totalF; fRight /= totalF; fBottom /= totalF; fLeft /= totalF; }
    else { fTop = fRight = fBottom = fLeft = 0.25; }
    
    vec4 weights = vec4(0.0);
    if (specTop == 0.0) weights.x += fTop; else if (specTop == 1.0) weights.y += fTop; else if (specTop == 2.0) weights.z += fTop; else weights.w += fTop;
    if (specRight == 0.0) weights.x += fRight; else if (specRight == 1.0) weights.y += fRight; else if (specRight == 2.0) weights.z += fRight; else weights.w += fRight;
    if (specBottom == 0.0) weights.x += fBottom; else if (specBottom == 1.0) weights.y += fBottom; else if (specBottom == 2.0) weights.z += fBottom; else weights.w += fBottom;
    if (specLeft == 0.0) weights.x += fLeft; else if (specLeft == 1.0) weights.y += fLeft; else if (specLeft == 2.0) weights.z += fLeft; else weights.w += fLeft;
    
    float total = weights.x + weights.y + weights.z + weights.w;
    if (total > 0.001) weights /= total; else weights = vec4(0.25);
    return weights;
}

float totalHeight(vec2 worldXZ) {
    float baseHeight;
    if (useWangTiles > 0.5) {
        vec4 weights = getWangWeights(worldXZ);
        float h0 =
            sampleHeightOctave(0, worldXZ, uTiles[0][0]) * uAmps[0][0] +
            sampleHeightOctave(0, worldXZ, uTiles[0][1]) * uAmps[0][1] +
            sampleHeightOctave(0, worldXZ, uTiles[0][2]) * uAmps[0][2];
        float h1 =
            sampleHeightOctave(3, worldXZ, uTiles[1][0]) * uAmps[1][0] +
            sampleHeightOctave(3, worldXZ, uTiles[1][1]) * uAmps[1][1] +
            sampleHeightOctave(3, worldXZ, uTiles[1][2]) * uAmps[1][2];
        float h2 =
            sampleHeightOctave(6, worldXZ, uTiles[2][0]) * uAmps[2][0] +
            sampleHeightOctave(6, worldXZ, uTiles[2][1]) * uAmps[2][1] +
            sampleHeightOctave(6, worldXZ, uTiles[2][2]) * uAmps[2][2];
        float h3 =
            sampleHeightOctave(9, worldXZ, uTiles[0][0]) * uAmps[0][0] +
            sampleHeightOctave(9, worldXZ, uTiles[0][1]) * uAmps[0][1] +
            sampleHeightOctave(9, worldXZ, uTiles[0][2]) * uAmps[0][2];
        baseHeight = h0 * weights.x + h1 * weights.y + h2 * weights.z + h3 * weights.w;
    } else if (showHexlMixing > 0.5) {
        float w0 = getWeight(worldXZ, 0.0), w1 = getWeight(worldXZ, 0.33), w2 = getWeight(worldXZ, 0.67);
        baseHeight = (
            sampleHeightOctave(0, worldXZ, uTiles[0][0]) * uAmps[0][0] * w0 +
            sampleHeightOctave(1, worldXZ, uTiles[0][1]) * uAmps[0][1] * w0 +
            sampleHeightOctave(2, worldXZ, uTiles[0][2]) * uAmps[0][2] * w0 +
            sampleHeightOctave(3, worldXZ, uTiles[1][0]) * uAmps[1][0] * w1 +
            sampleHeightOctave(4, worldXZ, uTiles[1][1]) * uAmps[1][1] * w1 + 
            sampleHeightOctave(5, worldXZ, uTiles[1][2]) * uAmps[1][2] * w1 +
            sampleHeightOctave(6, worldXZ, uTiles[2][0]) * uAmps[2][0] * w2 +
            sampleHeightOctave(7, worldXZ, uTiles[2][1]) * uAmps[2][1] * w2 +
            sampleHeightOctave(8, worldXZ, uTiles[2][2]) * uAmps[2][2] * w2)/(w0 + w1 + w2);
    } else {
        baseHeight = (
            sampleHeightOctave(0, worldXZ, uTiles[0][0]) * uAmps[0][0] +
            sampleHeightOctave(1, worldXZ, uTiles[0][1]) * uAmps[0][1] +
            sampleHeightOctave(2, worldXZ, uTiles[0][2]) * uAmps[0][2] +
            sampleHeightOctave(3, worldXZ, uTiles[1][0]) * uAmps[1][0] +
            sampleHeightOctave(4, worldXZ, uTiles[1][1]) * uAmps[1][1] +
            sampleHeightOctave(5, worldXZ, uTiles[1][2]) * uAmps[1][2] +
            sampleHeightOctave(6, worldXZ, uTiles[2][0]) * uAmps[2][0] +
            sampleHeightOctave(7, worldXZ, uTiles[2][1]) * uAmps[2][1] +
            sampleHeightOctave(8, worldXZ, uTiles[2][2]) * uAmps[2][2])/3;
    }
    if (showPerlinNoise > 0.5) baseHeight += perlinNoise(worldXZ * 0.3) * uPerlinStrength;
    return baseHeight * 0.5;
}

vec2 totalDisplacement(vec2 worldXZ) {
    vec2 baseDisp;
    if (useWangTiles > 0.5) {
        vec4 weights = getWangWeights(worldXZ);
        vec2 d0 =
            sampleDisplacementOctave(0, worldXZ, uTiles[0][0]) * uAmps[0][0] +
            sampleDisplacementOctave(0, worldXZ, uTiles[0][1]) * uAmps[0][1] +
            sampleDisplacementOctave(0, worldXZ, uTiles[0][2]) * uAmps[0][2];
        vec2 d1 =
            sampleDisplacementOctave(3, worldXZ, uTiles[1][0]) * uAmps[1][0] +
            sampleDisplacementOctave(3, worldXZ, uTiles[1][1]) * uAmps[1][1] +
            sampleDisplacementOctave(3, worldXZ, uTiles[1][2]) * uAmps[1][2];
        vec2 d2 =
            sampleDisplacementOctave(6, worldXZ, uTiles[2][0]) * uAmps[2][0] +
            sampleDisplacementOctave(6, worldXZ, uTiles[2][1]) * uAmps[2][1] +
            sampleDisplacementOctave(6, worldXZ, uTiles[2][2]) * uAmps[2][2];
        vec2 d3 =
            sampleDisplacementOctave(9, worldXZ, uTiles[0][0]) * uAmps[0][0] +
            sampleDisplacementOctave(9, worldXZ, uTiles[0][1]) * uAmps[0][1] +
            sampleDisplacementOctave(9, worldXZ, uTiles[0][2]) * uAmps[0][2];
        baseDisp = d0 * weights.x + d1 * weights.y + d2 * weights.z + d3 * weights.w;
    } else if (showHexlMixing > 0.5) {
        float w0 = getWeight(worldXZ, 0.0), w1 = getWeight(worldXZ, 0.33), w2 = getWeight(worldXZ, 0.67);
        baseDisp = (sampleDisplacementOctave(0, worldXZ, uTiles[0][0]) * uAmps[0][0] * w0 + sampleDisplacementOctave(1, worldXZ, uTiles[0][1]) * uAmps[0][1] * w0 + sampleDisplacementOctave(2, worldXZ, uTiles[0][2]) * uAmps[0][2] * w0 + sampleDisplacementOctave(3, worldXZ, uTiles[1][0]) * uAmps[1][0] * w1 + sampleDisplacementOctave(4, worldXZ, uTiles[1][1]) * uAmps[1][1] * w1 + sampleDisplacementOctave(5, worldXZ, uTiles[1][2]) * uAmps[1][2] * w1 + sampleDisplacementOctave(6, worldXZ, uTiles[2][0]) * uAmps[2][0] * w2 + sampleDisplacementOctave(7, worldXZ, uTiles[2][1]) * uAmps[2][1] * w2 + sampleDisplacementOctave(8, worldXZ, uTiles[2][2]) * uAmps[2][2] * w2)/2.8;
    } else {
        baseDisp = (sampleDisplacementOctave(0, worldXZ, uTiles[0][0]) * uAmps[0][0] + sampleDisplacementOctave(1, worldXZ, uTiles[0][1]) * uAmps[0][1] + sampleDisplacementOctave(2, worldXZ, uTiles[0][2]) * uAmps[0][2] + sampleDisplacementOctave(3, worldXZ, uTiles[1][0]) * uAmps[1][0] + sampleDisplacementOctave(4, worldXZ, uTiles[1][1]) * uAmps[1][1] + sampleDisplacementOctave(5, worldXZ, uTiles[1][2]) * uAmps[1][2] + sampleDisplacementOctave(6, worldXZ, uTiles[2][0]) * uAmps[2][0] + sampleDisplacementOctave(7, worldXZ, uTiles[2][1]) * uAmps[2][1] + sampleDisplacementOctave(8, worldXZ, uTiles[2][2]) * uAmps[2][2])/3;
    }
    if (showPerlinNoise > 0.5) {
        float px = perlinNoise(worldXZ * 0.3 + vec2(100.0, 0.0)), pz = perlinNoise(worldXZ * 0.3 + vec2(0.0, 100.0));
        baseDisp += vec2(px, pz) * uPerlinStrength * 0.3;
    }

    return baseDisp;
}

void main() {
    float skip = log2(uLODSkip + 1.0) / log2(10.0);
    if (skip < 0.001) skip = 1.0;
    vec2 worldXZ = (position.xz / skip + 0.5) * skip;

    float waveHeight = totalHeight(worldXZ);
    vec2 displacedXZ = worldXZ + totalDisplacement(worldXZ);
    vec3 waterPosition = vec3(displacedXZ.x, waveHeight, displacedXZ.y);

    const float eps = 0.1;
    float hL = totalHeight(worldXZ + vec2(-eps, 0.0)), hR = totalHeight(worldXZ + vec2(+eps, 0.0));
    float hD = totalHeight(worldXZ + vec2(0.0, -eps)), hU = totalHeight(worldXZ + vec2(0.0, +eps));
    vec3 normalW = normalize(vec3(hL - hR, 2.0 * eps, hD - hU));

    vPositionW = vec3(world * vec4(waterPosition, 1.0));
    vNormalW = vec3(world * vec4(normalW, 0.0));
    vPositionClip = worldViewProjection * vec4(waterPosition, 1.0);
    vUV = fract(worldXZ / uTiles[1][1]);

    vTileUV0 = fract(worldXZ / uTiles[0][0]);
    vTileUV1 = fract(worldXZ / uTiles[0][1]);
    vTileUV2 = fract(worldXZ / uTiles[0][2]);
    vWangXZ = position.xz;
    vWorldXZ = worldXZ;

    gl_Position = vPositionClip;
}