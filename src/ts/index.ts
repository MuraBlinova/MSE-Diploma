let showWireframe = false;

createButton("wireframe", 50, 10, (btn) => {
    showWireframe = !showWireframe;
    scene.meshes.forEach(mesh => { if (mesh.material === waterMaterial) mesh.material.wireframe = showWireframe; });
    btn.style.background = showWireframe ? "#0a0" : "#222";
});
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

// ========== МЕТРИКИ ПРОИЗВОДИТЕЛЬНОСТИ ==========
// Настройки
const PERF_LOG_INTERVAL_MS = 5000; // Интервал сбора статистики (5 секунд)
const HISTORY_SIZE = 12; // Храним 12 интервалов (1 минута)

// Типы для метрик
interface MetricsStats {
    avgFrameTime: string;
    minFrameTime: string;
    maxFrameTime: string;
    fps: string;
    fps1PercentLow: string;
    frameCount: number;
    drawCalls: number;
    activeMeshes: number;
    gpuTimeMs: number;
}

interface HistoryEntry extends MetricsStats {
    timestamp: number;
}

// Функция для получения draw calls из WebGPUEngine
function getDrawCalls(): number {
    // Правильное получение draw calls
    if (typeof (engine as any).getDrawCalls === 'function') {
        return (engine as any).getDrawCalls();
    }
    // Альтернативный способ
    if ((engine as any)._drawCalls && typeof (engine as any)._drawCalls === 'number') {
        return (engine as any)._drawCalls;
    }
    // Если ничего не работает
    return 0;
}

// Хранилище истории
let frameTimes: number[] = [];
let frameTimestamps: number[] = [];
let perfHistory: HistoryEntry[] = [];

// Текущие метрики
let currentMetrics = {
    fps: 0,
    frameTime: 0,
    minFrameTime: Infinity,
    maxFrameTime: 0,
    drawCalls: 0,
    activeMeshes: 0,
    gpuTimeMs: 0,
    timestamp: 0
};

// Сбор метрик каждый кадр
function collectMetrics(): void {
    const frameTime = engine.getDeltaTime();
    
    frameTimes.push(frameTime);
    frameTimestamps.push(performance.now());
    
    if (frameTimes.length > 60) {
        frameTimes.shift();
        frameTimestamps.shift();
    }
}

// Расчет статистики за интервал
function calculateIntervalStats(): MetricsStats | null {
    if (frameTimes.length === 0) return null;
    
    const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    // Защита от деления на ноль
    if (avgFrameTime === 0) {
        return {
            avgFrameTime: "16.67",
            minFrameTime: "16.00",
            maxFrameTime: "17.00",
            fps: "60.0",
            fps1PercentLow: "60.0",
            frameCount: frameTimes.length,
            drawCalls: getDrawCalls(),
            activeMeshes: scene.getActiveMeshes().length,
            gpuTimeMs: currentMetrics.gpuTimeMs,
        };
    }
    
    const minFrameTime = Math.min(...frameTimes);
    const maxFrameTime = Math.max(...frameTimes);
    const fps = 1000 / avgFrameTime;
    
    const sortedTimes = [...frameTimes].sort((a, b) => b - a);
    const onePercentCount = Math.max(1, Math.floor(sortedTimes.length * 0.01));
    const worstTimes = sortedTimes.slice(0, onePercentCount);
    const avgWorstFrameTime = worstTimes.reduce((a, b) => a + b, 0) / worstTimes.length;
    const fps1PercentLow = 1000 / avgWorstFrameTime;
    
    return {
        avgFrameTime: avgFrameTime.toFixed(2),
        minFrameTime: minFrameTime.toFixed(2),
        maxFrameTime: maxFrameTime.toFixed(2),
        fps: fps.toFixed(1),
        fps1PercentLow: fps1PercentLow.toFixed(1),
        frameCount: frameTimes.length,
        drawCalls: getDrawCalls(),
        activeMeshes: scene.getActiveMeshes().length,
        gpuTimeMs: currentMetrics.gpuTimeMs,
    };
}

// Вывод в консоль с цветом
function logToConsole(stats: MetricsStats, isSummary: boolean = false): void {
    const prefix = isSummary ? "📊 [SUMMARY]" : "📈 [METRICS]";
    
    console.log(
        `%c${prefix} %cFPS: ${stats.fps} (1% low: ${stats.fps1PercentLow}) | Frame: ${stats.avgFrameTime}ms [${stats.minFrameTime}-${stats.maxFrameTime}] | Draws: ${stats.drawCalls} | Meshes: ${stats.activeMeshes}${stats.gpuTimeMs ? ` | GPU: ${stats.gpuTimeMs}ms` : ''}`,
        'color: #0f0; font-weight: bold',
        'color: #fff'
    );
    
    if (parseFloat(stats.fps) < 45) {
        console.warn(`⚠️ Low FPS detected: ${stats.fps}`);
    }
    if (parseFloat(stats.avgFrameTime) > 33) {
        console.error(`❌ High frame time: ${stats.avgFrameTime}ms`);
    }
}

// Запись логов в файл
let logBuffer: string[] = [];

function saveLogsToFile(): void {
    const blob = new Blob([logBuffer.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `perf_logs_${new Date().toISOString().slice(0,19)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`💾 Logs saved to file (${logBuffer.length} entries)`);
}

// Сохранение в IndexedDB
function saveToIndexedDB(entry: HistoryEntry): void {
    const request = indexedDB.open('PerfLogsDB', 1);
    
    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('metrics')) {
            db.createObjectStore('metrics', { keyPath: 'timestamp' });
        }
    };
    
    request.onsuccess = (event: Event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const tx = db.transaction(['metrics'], 'readwrite');
        const store = tx.objectStore('metrics');
        store.add(entry);
        tx.oncomplete = () => db.close();
    };
}

// Основной интервальный логгер
let intervalCount = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;

function logPerformanceInterval(): void {
    const now = performance.now();
    const stats = calculateIntervalStats();
    
    if (!stats) return;
    
    const historyEntry: HistoryEntry = {
        timestamp: now,
        ...stats
    };
    perfHistory.push(historyEntry);
    if (perfHistory.length > HISTORY_SIZE) perfHistory.shift();
    
    logToConsole(stats);
    
    const logLine = `[${new Date(now).toLocaleTimeString()}] FPS:${stats.fps} | 1%Low:${stats.fps1PercentLow} | FT:${stats.avgFrameTime}ms [${stats.minFrameTime}-${stats.maxFrameTime}] | DC:${stats.drawCalls}`;
    logBuffer.push(logLine);
    if (logBuffer.length > 1000) logBuffer.shift();
    
    if (intervalCount % 5 === 0) {
        saveToIndexedDB(historyEntry);
    }
    
    intervalCount++;
    
    if (intervalCount % 12 === 0 && perfHistory.length >= 12) {
        generateSummaryReport();
    }
}

// Генерация сводного отчета
function generateSummaryReport(): void {
    if (perfHistory.length === 0) return;
    
    const avgFps = perfHistory.reduce((sum, h) => sum + parseFloat(h.fps), 0) / perfHistory.length;
    const minFps = Math.min(...perfHistory.map(h => parseFloat(h.fps)));
    const maxFps = Math.max(...perfHistory.map(h => parseFloat(h.fps)));
    const avgFrameTime = perfHistory.reduce((sum, h) => sum + parseFloat(h.avgFrameTime), 0) / perfHistory.length;
    const avgDrawCalls = perfHistory.reduce((sum, h) => sum + h.drawCalls, 0) / perfHistory.length;
    
    const summary = {
        type: 'summary',
        timestamp: Date.now(),
        period_seconds: (perfHistory.length * PERF_LOG_INTERVAL_MS) / 1000,
        avg_fps: avgFps.toFixed(1),
        min_fps: minFps.toFixed(1),
        max_fps: maxFps.toFixed(1),
        avg_frame_time_ms: avgFrameTime.toFixed(2),
        avg_draw_calls: Math.round(avgDrawCalls),
        total_samples: perfHistory.length
    };
    
    console.log('%c📊 ========== PERFORMANCE SUMMARY ==========', 'color: #ffa500; font-weight: bold');
    console.log(`   Period: ${summary.period_seconds}s (${summary.total_samples} samples)`);
    console.log(`   FPS: avg=${summary.avg_fps} | min=${summary.min_fps} | max=${summary.max_fps}`);
    console.log(`   Frame Time: avg=${summary.avg_frame_time_ms}ms`);
    console.log(`   Draw Calls: avg=${summary.avg_draw_calls}`);
    console.log('%c============================================', 'color: #ffa500; font-weight: bold');
    
    logBuffer.push(`\n=== SUMMARY ${new Date().toISOString()} ===\n${JSON.stringify(summary, null, 2)}\n`);
    saveToIndexedDB(summary as unknown as HistoryEntry);
}

// Кнопки управления логами
function addLogControls(): void {
    const controls = document.createElement("div");
    controls.style.position = "fixed";
    controls.style.bottom = "10px";
    controls.style.right = "10px";
    controls.style.zIndex = "1001";
    controls.style.display = "flex";
    controls.style.gap = "8px";
    
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "💾 Save Logs";
    saveBtn.style.padding = "4px 8px";
    saveBtn.style.fontSize = "10px";
    saveBtn.style.background = "#222";
    saveBtn.style.color = "#fff";
    saveBtn.style.border = "none";
    saveBtn.style.borderRadius = "4px";
    saveBtn.style.cursor = "pointer";
    saveBtn.onclick = saveLogsToFile;
    
    const clearBtn = document.createElement("button");
    clearBtn.textContent = "🗑 Clear Logs";
    clearBtn.style.padding = "4px 8px";
    clearBtn.style.fontSize = "10px";
    clearBtn.style.background = "#222";
    clearBtn.style.color = "#fff";
    clearBtn.style.border = "none";
    clearBtn.style.borderRadius = "4px";
    clearBtn.style.cursor = "pointer";
    clearBtn.onclick = () => {
        logBuffer = [];
        console.log("🧹 Log buffer cleared");
    };
    
    controls.appendChild(saveBtn);
    controls.appendChild(clearBtn);
    document.body.appendChild(controls);
}

function startPerformanceLogging(): void {
    frameTimes = [];
    frameTimestamps = [];
    intervalCount = 0;
    
    intervalId = setInterval(() => {
        logPerformanceInterval();
    }, PERF_LOG_INTERVAL_MS);
    
    console.log(`✅ Performance logging started (interval: ${PERF_LOG_INTERVAL_MS/1000}s)`);
}

// Запускаем логирование
startPerformanceLogging();
addLogControls();
// ========== КОНЕЦ МЕТРИК ==========

// ───────────────────────────────────
// UI
// ───────────────────────────────────

let showTileBorders = false;
createButton("tile borders", 90, 10, (btn) => {
    showTileBorders = !showTileBorders;
    if (waterMaterial) waterMaterial.setFloat("showTileBorders", showTileBorders ? 1.0 : 0.0);
    btn.style.background = showTileBorders ? "#0a0" : "#222";
});

let showHexGrid = false;
createButton("hex grid", 210, 10, (btn) => {
    showHexGrid = !showHexGrid;
    waterMaterial.setFloat("showHexGrid", showHexGrid ? 1.0 : 0.0);
    btn.style.background = showHexGrid ? "#0a0" : "#222";
});

let showPerlinNoise = false;
createButton("perlin", 130, 10, (btn) => {
    showPerlinNoise = !showPerlinNoise;
    waterMaterial.setFloat("showPerlinNoise", showPerlinNoise ? 1.0 : 0.0);
    btn.style.background = showPerlinNoise ? "#0a0" : "#222";
});

let showHexlMixing = false;
const HexMixdBtn = createButton("hex mix", 170, 10, (btn) => {
    if(wangSpectrumEnabled){ WangMixBtn.click(); }
    showHexlMixing = !showHexlMixing;
    waterMaterial.setFloat("showHexlMixing", showHexlMixing ? 1.0 : 0.0);
    btn.style.background = showHexlMixing ? "#0a0" : "#222";
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
waterMaterial.setFloat("showTileBorders", showTileBorders ? 1.0 : 0.0);
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

const WangMixBtn = createButton("wang mix", 250, 10, (btn) => {
    if (showHexlMixing) { HexMixdBtn.click(); }
    wangSpectrumEnabled = !wangSpectrumEnabled;
    waterColorBtn.style.display == 'block' ? waterColorBtn.style.display = 'none' : waterColorBtn.style.display = 'block';
    regenWaterBtn.style.display == 'block' ? regenWaterBtn.style.display = 'none' : regenWaterBtn.style.display = 'block';
    if (wangSpectrumEnabled) {
        if (!spectrumAtlas) {
            spectrumAtlas = new WangTileSpectrumAtlas(tileSet.numColors, 64);
            const existing = document.getElementById('spectrum-preview');
            if (existing) existing.remove();
            createPreview(spectrumAtlas.createDebugPreview(tileSet.colors).toDataURL(), 10, 10, "#0af", "spectrum-preview");
        }
        waterMaterial.setWangTiles(generator, spectrumAtlas, tileSet);
        waterMaterial.enableWangTiles();
        btn.style.background = "#0a0";
    } else {
        waterMaterial.disableWangTiles();
        const preview = document.getElementById('spectrum-preview');
        if (preview) preview.remove();
        spectrumAtlas = null;
        btn.style.background = "#222";
    }
});

const regenWaterBtn = createButton("regen wang", 290, 10, (btn) => {
    generator.generate();
    atlasRenderer.rebuild();
    if (wangSpectrumEnabled && spectrumAtlas) {
        waterMaterial.setWangTiles(generator, spectrumAtlas, tileSet);
        waterMaterial.enableWangTiles();
    }
});
regenWaterBtn.style.display = 'none';

let wangColorWaterEnabled = false;
const waterColorBtn = createButton("water color", 330, 10, (btn) => {
    wangColorWaterEnabled = !wangColorWaterEnabled;
    waterMaterial.setFloat("showWangColors", wangColorWaterEnabled ? 1.0 : 0.0);
    btn.style.background = wangColorWaterEnabled ? "#0a0" : "#222";
});
waterColorBtn.style.display = 'none';

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
    
    // Сбор метрик производительности
    collectMetrics();
    
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