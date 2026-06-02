import "../styles/index.css";

const fpsOverlay = createFPSOverlay();

import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import "@babylonjs/core/Loading/loadingScreen";
import { WebGPUEngine } from "@babylonjs/core/Engines";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { PostProcess } from "@babylonjs/core/PostProcesses/postProcess";
import { Effect } from "@babylonjs/core/Materials/effect";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import { WaterMaterial } from "./waterMaterial";
import wangAtlasVert from "../shaders/wangAtlas/vertex.glsl";
import wangAtlasFrag from "../shaders/wangAtlas/fragment.glsl";
import { PhillipsSpectrum } from "./spectrum/phillipsSpectrum";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import postProcessCode from "../shaders/smallPostProcess.glsl";
import { createWangTileSet } from "./wangTiles/wangTileSet";
import { WFCGenerator } from "./wangTiles/wfcGenerator";
import { WangTileAtlas } from "./wangTiles/wangTileAtlas";
import { WangTileAtlasRenderer } from "./wangTiles/wangTileAtlasRenderer";
import { WangTileSpectrumAtlas } from "./wangTiles/wangTileSpectrumAtlas";

import { createButton, createFPSOverlay, createPreview } from "./ui";   

// ───────────────────────────────────
// UI
// ───────────────────────────────────
let hidemix = false;
const MixBtn = createButton("Вариант 2", 130, 10, (btn) => {
    if(!hidemix){
        hidemix = !hidemix;
        if(showPerlinNoise) { PerlinBtn.click(); }
        if(showHexlMixing) { HexMixdBtn.click(); }
        if(wangSpectrumEnabled) { WangMixBtn.click(); }
    } else if (showPerlinNoise || showHexlMixing || wangSpectrumEnabled) {
        hidemix = !hidemix;
    }
    btn.style.background = hidemix ? "#0a0" : "#222";
});

let showPerlinNoise = false;
const PerlinBtn = createButton("Вариант 4", 210, 10, (btn) => {
    if(!showPerlinNoise){
        showPerlinNoise = !showPerlinNoise;
        if(hidemix) { MixBtn.click(); }
        if(showHexlMixing) { HexMixdBtn.click(); }
        if(wangSpectrumEnabled) { WangMixBtn.click(); }
    } else if (hidemix || showHexlMixing || wangSpectrumEnabled) {
        showPerlinNoise = !showPerlinNoise;
    }
    waterMaterial.setFloat("showPerlinNoise", showPerlinNoise ? 1.0 : 0.0);
    btn.style.background = showPerlinNoise ? "#0a0" : "#222";
});

let showHexlMixing = true;
const HexMixdBtn = createButton("Вариант 1", 90, 10, (btn) => {
    if(!showHexlMixing){
        showHexlMixing = !showHexlMixing;
        if(hidemix) { MixBtn.click(); }
        if(showPerlinNoise) { PerlinBtn.click(); }
        if(wangSpectrumEnabled){ WangMixBtn.click(); }
    } else if (hidemix || showPerlinNoise || wangSpectrumEnabled) {
        showHexlMixing = !showHexlMixing;
    }
    waterMaterial.setFloat("showHexlMixing", showHexlMixing ? 1.0 : 0.0);
    btn.style.background = showHexlMixing ? "#0a0" : "#222";
});
HexMixdBtn.style.background = "#0a0";

const WangMixBtn = createButton("Вариант 3", 170, 10, (btn) => {
    if (!wangSpectrumEnabled) {
        wangSpectrumEnabled = !wangSpectrumEnabled;
        if(hidemix) { MixBtn.click(); }
        if(showPerlinNoise) { PerlinBtn.click(); }
        if(showHexlMixing) { HexMixdBtn.click(); }

        if (!spectrumAtlas) {
            spectrumAtlas = new WangTileSpectrumAtlas(tileSet.numColors, 64);
            const existing = document.getElementById('spectrum-preview');
            if (existing) existing.remove();
            createPreview(spectrumAtlas.createDebugPreview(tileSet.colors).toDataURL(), 10, 10, "#0af", "spectrum-preview");
        }
        waterMaterial.setWangTiles(generator, spectrumAtlas, tileSet);
        waterMaterial.enableWangTiles();
        btn.style.background = "#0a0";
    } else if (hidemix || showPerlinNoise || showHexlMixing) {
        wangSpectrumEnabled = !wangSpectrumEnabled;
        waterMaterial.disableWangTiles();
        const preview = document.getElementById('spectrum-preview');
        if (preview) preview.remove();
        spectrumAtlas = null;
        btn.style.background = "#222";
    }
});

const canvas = document.getElementById("renderer") as HTMLCanvasElement;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
if (!(await WebGPUEngine.IsSupportedAsync)) { alert("WebGPU is not supported in your browser."); }

const engine = new WebGPUEngine(canvas, { antialias: true });
engine.loadingScreen.displayLoadingUI();
await engine.initAsync();
const scene = new Scene(engine);

const camera = new ArcRotateCamera("camera", 3.14 / 3, 0.02 + 3.14 / 2, 15, new Vector3(0, 1.5, 0), scene);
camera.wheelPrecision = 100;
camera.angularSensibilityX = 3000;
camera.angularSensibilityY = 3000;
camera.lowerRadiusLimit = 2;
camera.attachControl();

// WASD movement
const keys: { [key: string]: boolean } = {};
window.addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; });
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

scene.registerBeforeRender(() => {
    const speed = 0.5;
    const alpha = camera.alpha;
    const forwardX = Math.cos(alpha);
    const forwardZ = Math.sin(alpha);
    const rightX = -Math.sin(alpha);
    const rightZ = Math.cos(alpha);
    let moveX = 0, moveZ = 0;
    if (keys["w"]) { moveX -= forwardX; moveZ -= forwardZ; }
    if (keys["s"]) { moveX += forwardX; moveZ += forwardZ; }
    if (keys["a"]) { moveX -= rightX; moveZ -= rightZ; }
    if (keys["d"]) { moveX += rightX; moveZ += rightZ; }
    if (moveX !== 0 || moveZ !== 0) {
        const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
        camera.target.addInPlaceFromFloats(moveX / len * speed, 0, moveZ / len * speed);
    }
});

const light = new DirectionalLight("light", new Vector3(1, -1, 3).normalize(), scene);

const textureSize = 128;
const spectra = [
    new PhillipsSpectrum(textureSize, 10, engine),
    new PhillipsSpectrum(textureSize, 10, engine),
    new PhillipsSpectrum(textureSize, 10, engine),
    new PhillipsSpectrum(textureSize, 10, engine),
];
spectra[0].settings.windSpeed = 100;
spectra[1].settings.windSpeed = 10;
spectra[2].settings.windSpeed = 90;
spectra[3].settings.windSpeed = 20;
spectra[0].settings.windTheta = 0;
spectra[1].settings.windTheta = Math.PI / 2;
spectra[2].settings.windTheta = Math.PI;
spectra[3].settings.windTheta = Math.PI / 8;
spectra.forEach(s => s.updateSettingsGPU());

const TILE_SIZE = 20.0;

// ───────────────────────────────────
// Water material
// ───────────────────────────────────

const waterMaterial = new WaterMaterial("water", spectra, scene, engine);
// waterMaterial.setFloat("showTileBorders", showTileBorders ? 1.0 : 0.0);
waterMaterial.setFloat("uGridStep", TILE_SIZE);
waterMaterial.setTexture("normalMapOverlay", waterMaterial.gradientMap);
waterMaterial.backFaceCulling = false;

Effect.ShadersStore["wangAtlasVertexShader"] = wangAtlasVert;
Effect.ShadersStore["wangAtlasFragmentShader"] = wangAtlasFrag;

const myTiles = [ //набор плиток Вана, который даёт апериодичческое замощение
    [0, 0, 0, 1], [2, 0, 2, 1], [0, 1, 1, 1],
    [3, 2, 0, 2], [2, 2, 3, 2], [3, 3, 0, 3],
    [0, 1, 2, 3], [2, 3, 2, 0], [2, 0, 3, 0],
    [1, 1, 2, 0], [0, 3, 0, 1],
];
const tileSet = createWangTileSet(myTiles, 4, "Custom 11 tiles");
console.log('Wang tile set:', tileSet.name, '(', tileSet.tileCount, 'tiles)');

const MAP_SIZE = 16;
const generator = new WFCGenerator(tileSet, MAP_SIZE, MAP_SIZE);
generator.generate();

const atlas = new WangTileAtlas(tileSet.numColors, 256);

const atlasRenderer = new WangTileAtlasRenderer(scene, generator, atlas, MAP_SIZE, TILE_SIZE);

let spectrumAtlas: WangTileSpectrumAtlas | null = null;
let wangSpectrumEnabled = false;

const skybox = MeshBuilder.CreateBox("skyBox", { size: camera.maxZ / 2 }, scene);
const skyboxMaterial = new StandardMaterial("skyBox", scene);
skyboxMaterial.backFaceCulling = false;
skyboxMaterial.reflectionTexture = waterMaterial.reflectionTexture;
skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
skyboxMaterial.disableLighting = true;
skybox.material = skyboxMaterial;

const totalSize = MAP_SIZE * TILE_SIZE;
const maxSubdiv = 320;
const water = MeshBuilder.CreateGround("water", { width: totalSize, height: totalSize, subdivisions: maxSubdiv }, scene);
water.material = waterMaterial;

// ───────────────────────────────────
// Wave parameters
// ───────────────────────────────────

let lastLODSkip = -1;
scene.registerBeforeRender(() => {
    const distToWater = Math.max(0.1, camera.globalPosition.y - water.position.y);
    if(wangSpectrumEnabled){
        let lodSkip = 0.8;
        waterMaterial.setFloat("uLODSkip", lodSkip);
    }else{
        let lodSkip = Math.abs(distToWater / 50);
        if (lodSkip !== lastLODSkip) { waterMaterial.setFloat("uLODSkip", lodSkip); lastLODSkip = lodSkip; }
    }
    let amp0 = 0.005, amp1 = 0.03, amp2 = 0.25;
    const t0 = 20.0 * Math.atan((distToWater - 500.0) / 100.0) + 30.0;
    const t1 = 20.0 * Math.atan((distToWater - 500.0) / 100.0) + 30.0;
    const t2 = 20.0 * Math.atan((distToWater - 500.0) / 100.0) + 30.0;
    waterMaterial.setAllWaveParams(t0, t0*2, t0*8, amp0, amp1, amp2, t1, t1*2, t1*8, amp0, amp1, amp2, t2, t2*2, t2*8, amp0, amp1, amp2);
});

const depthRenderer = scene.enableDepthRenderer(camera, false, true);
Effect.ShadersStore["PostProcess1FragmentShader"] = postProcessCode;
const postProcess = new PostProcess("postProcess1", "PostProcess1",
    ["cameraInverseView", "cameraInverseProjection", "cameraPosition"],
    ["textureSampler", "depthSampler"], 1, camera, Texture.BILINEAR_SAMPLINGMODE, engine);
postProcess.onApplyObservable.add((effect) => {
    effect.setTexture("depthSampler", depthRenderer.getDepthMap());
    effect.setMatrix("cameraInverseView", camera.getViewMatrix().clone().invert());
    effect.setMatrix("cameraInverseProjection", camera.getProjectionMatrix().clone().invert());
});

function updateScene() { waterMaterial.update(engine.getDeltaTime() / 1000, light.direction); }

engine.loadingScreen.hideLoadingUI();
scene.registerBeforeRender(() => updateScene());

let lastFpsPrint = performance.now();
let frameCount = 0;
engine.runRenderLoop(() => {
    scene.render();
    frameCount++;
    const now = performance.now();
    if (now - lastFpsPrint > 1000) {
        console.log("FPS:", frameCount, "dist to water:", Math.abs(camera.globalPosition.y - water.position.y));
        fpsOverlay.textContent = `FPS: ${frameCount}`;
        frameCount = 0;
        lastFpsPrint = now;
    }
});

window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    engine.resize(true);
});
