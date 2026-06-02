precision highp float;

varying vec3 vNormalW;
varying vec3 vPositionW;
varying vec4 vPositionClip;
varying vec2 vUV;
varying vec2 vTileUV0;
varying vec2 vTileUV1;
varying vec2 vTileUV2;
varying vec2 vWangXZ;
varying vec2 vWorldXZ;

uniform vec3 cameraPositionW;
uniform vec3 lightDirection;

uniform sampler2D depthSampler;
uniform sampler2D textureSampler;
uniform samplerCube reflectionSampler;
uniform sampler2D normalMapOverlay;
uniform float showNormalMapOverlay;
uniform float showTileBorders;
uniform float showHexGrid;
uniform float showSpectralMixing;
uniform float uGridStep;
uniform float useWangTiles;
uniform float wangMapWidth;
uniform float wangMapHeight;
uniform float wangPadding;
uniform float showWangColors;

uniform sampler2D wangSpectraMap;

float edgeDist(vec2 uv) {
    return min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
}

float hexGridDist(vec2 p) {
    float L = uGridStep;

    float fx = mod(p.x, L);
    float d1 = min(fx, L - fx);

    float diag1 = p.x * 0.5 + p.y * 0.8660254;
    float fd1 = mod(diag1, L);
    float d2 = min(fd1, L - fd1);

    float diag2 = p.x * 0.5 - p.y * 0.8660254;
    float fd2 = mod(diag2, L);
    float d3 = min(fd2, L - fd2);

    return min(min(d1, d2), d3);
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

int getSpectrumAtNode(float m, float n) {
    float h = hash(vec2(m, n));
    if (h < 0.333) return 0;
    if (h < 0.666) return 1;
    return 2;
}

float hexPointDist(vec2 p) {
    float L = uGridStep;

    float fx = mod(p.x + L * 0.5, L) - L * 0.5;
    float diag1 = p.x * 0.5 + p.y * 0.8660254;
    float fd1 = mod(diag1 + L * 0.5, L) - L * 0.5;
    float diag2 = p.x * 0.5 - p.y * 0.8660254;
    float fd2 = mod(diag2 + L * 0.5, L) - L * 0.5;

    return sqrt(fx*fx + fd1*fd1 + fd2*fd2);
}

void main() {
    vec3 normal = vNormalW;

    vec2 screenUV = vPositionClip.xy / vPositionClip.w;
    screenUV = screenUV * 0.5 + 0.5;

    vec3 backgroundColor = texture2D(textureSampler, screenUV).rgb;

    float surfaceDepth = vPositionClip.z;
    float backgroundDepth = texture2D(depthSampler, screenUV).r;

    float distanceThroughWater = max(surfaceDepth - backgroundDepth, 0.0);

    float ndl = max(0.0, dot(normal, -lightDirection));

    vec3 deepColor = vec3(0.02, 0.1, 0.24);
    vec3 shallowColor = vec3(0.05, 0.25, 0.4);
    vec3 diffuseColor = mix(deepColor, shallowColor, ndl);
    diffuseColor = mix(diffuseColor, backgroundColor, exp(-distanceThroughWater * 0.15));

    if (showNormalMapOverlay > 0.5) {
        vec2 normalSample = texture2D(normalMapOverlay, vUV).rg;
        float nx = clamp(normalSample.r, -1.0, 1.0);
        float nz = clamp(normalSample.g, -1.0, 1.0);
        diffuseColor = vec3(nx * 0.5 + 0.5, 0.5, nz * 0.5 + 0.5);
        gl_FragColor = vec4(diffuseColor, 0.2);
        return;
    }

    vec3 viewRayW = normalize(vPositionW - cameraPositionW);
    vec3 viewRayReflectedW = reflect(viewRayW, normal);

    float fresnel = 0.02 + 0.98 * pow(1.0 - dot(-viewRayW, normal), 5.0);

    vec3 reflectedColor = textureCube(reflectionSampler, viewRayReflectedW).rgb;

    float specular = pow(max(0.0, dot(reflect(-lightDirection, normal), viewRayW)), 720.0) * 210.0;

    vec3 finalColor = mix(diffuseColor * ndl, reflectedColor + specular, fresnel);

    if (showTileBorders > 0.5) {
        vec3 c0 = vec3(1.0, 1.0, 0.0);
        vec3 c1 = vec3(0.0, 1.0, 1.0);
        vec3 c2 = vec3(1.0, 0.0, 1.0);
        finalColor = mix(finalColor, c2, smoothstep(0.02, 0.0, edgeDist(vTileUV2)) * 1.0);
        finalColor = mix(finalColor, c1, smoothstep(0.02, 0.0, edgeDist(vTileUV1)) * 1.0);
        finalColor = mix(finalColor, c0, smoothstep(0.02, 0.0, edgeDist(vTileUV0)) * 1.0);
    }

    if (showHexGrid > 0.5) {
        float dLine = hexGridDist(vWorldXZ);
        float alphaLine = smoothstep(0.08, 0.0, dLine) * 0.4;
        finalColor = mix(finalColor, vec3(1.0, 1.0, 0.0), alphaLine);
        float dPoint = hexPointDist(vWorldXZ);
        float L = uGridStep;
        float m = (vWorldXZ.x / L + vWorldXZ.y / (L * 0.8660254)) / 2.0;
        float n = (vWorldXZ.x / L - vWorldXZ.y / (L * 0.8660254)) / 2.0;
        float m0 = floor(m + 0.5);
        float n0 = floor(n + 0.5);
        int spectrum = getSpectrumAtNode(m0, n0);
        vec3 nodeColor;
        if (spectrum == 0) nodeColor = vec3(1.0, 0.0, 0.0);
        else if (spectrum == 1) nodeColor = vec3(0.0, 1.0, 0.0);
        else nodeColor = vec3(0.0, 0.0, 1.0);
        float alphaPoint = smoothstep(1.0, 0.0, dPoint) * 0.7;
        finalColor = mix(finalColor, nodeColor, alphaPoint);
    }

    if (useWangTiles > 0.5 && showWangColors > 0.5) {
        float halfWaterSize = uGridStep * (wangMapWidth / wangPadding) / 2.0;
        float adjustedX = vWangXZ.x + halfWaterSize;
        float adjustedZ = vWangXZ.y + halfWaterSize;
        
        float rawX = adjustedX / uGridStep;
        float rawZ = adjustedZ / uGridStep;
        float localX = rawX - floor(rawX);
        float localZ = rawZ - floor(rawZ);
        
        float tileX = floor(rawX);
        float tileZ = floor(rawZ);
        
        if (localX > 0.999) { tileX -= 1.0; localX = 0.0; }
        if (localZ > 0.999) { tileZ -= 1.0; localZ = 0.0; }
        if (localX < 0.001) { localX = 1.0; }
        if (localZ < 0.001) { localZ = 1.0; }
        
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
        
        vec2 localUV = fract(vWangXZ / uGridStep);
        float u = localUV.x, v = localUV.y;
        
        float dTop = v;
        float dRight = 1.0 - u;
        float dBottom = 1.0 - v;
        float dLeft = u;
        
        float minDist = min(min(dTop, dRight), min(dBottom, dLeft));
        
        float domSpectrum;
        if (minDist == dTop) domSpectrum = spectra.x;
        else if (minDist == dRight) domSpectrum = spectra.y;
        else if (minDist == dBottom) domSpectrum = spectra.z;
        else domSpectrum = spectra.w;
        
        domSpectrum = clamp(floor(domSpectrum + 0.5), 0.0, 3.0);
        
        vec3 spectrumColor;
        if (domSpectrum == 0.0) spectrumColor = vec3(1.0, 0.2, 0.2);
        else if (domSpectrum == 1.0) spectrumColor = vec3(0.2, 1.0, 0.2);
        else if (domSpectrum == 2.0) spectrumColor = vec3(0.2, 0.5, 1.0);
        else spectrumColor = vec3(1.0, 0.9, 0.2);
        
        float borderDist = min(min(localUV.x, 1.0 - localUV.x), min(localUV.y, 1.0 - localUV.y));
        float borderAlpha = 1.0 - smoothstep(0.0, 0.03, borderDist);
        spectrumColor = mix(spectrumColor, vec3(0.0), borderAlpha * 0.5);
        
        float alpha = 0.4;
        finalColor = mix(finalColor, spectrumColor, alpha);
    }

    gl_FragColor = vec4(finalColor, 1.0);
}