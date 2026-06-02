import fragment from "../shaders/waterMaterial/fragment.glsl";
import vertex from "../shaders/waterMaterial/vertex.glsl";

import { Scene } from "@babylonjs/core/scene";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { IFFT } from "./utils/IFFT";
import { createStorageTexture } from "./utils/utils";
import { DynamicSpectrum } from "./spectrum/dynamicSpectrum";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Effect } from "@babylonjs/core/Materials/effect";
import { Constants } from "@babylonjs/core/Engines/constants";
import { InitialSpectrum } from "./spectrum/initialSpectrum";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import { DepthRenderer } from "@babylonjs/core/Rendering/depthRenderer";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
import { WangTileSpectrumAtlas } from "./wangTiles/wangTileSpectrumAtlas";
import { WangTileGenerator } from "./wangTiles/wangTileGenerator";
import { WangTileSet } from "./wangTiles/wangTileSet";

import TropicalSunnyDay_px from "../assets/skybox/TropicalSunnyDay_px.jpg";
import TropicalSunnyDay_py from "../assets/skybox/TropicalSunnyDay_py.jpg";
import TropicalSunnyDay_pz from "../assets/skybox/TropicalSunnyDay_pz.jpg";
import TropicalSunnyDay_nx from "../assets/skybox/TropicalSunnyDay_nx.jpg";
import TropicalSunnyDay_ny from "../assets/skybox/TropicalSunnyDay_ny.jpg";
import TropicalSunnyDay_nz from "../assets/skybox/TropicalSunnyDay_nz.jpg";

export class WaterMaterial extends ShaderMaterial {
    readonly textureSize: number;
    readonly reflectionTexture: CubeTexture;
    readonly depthRenderer: DepthRenderer;
    readonly screenRenderTarget: RenderTargetTexture;

    private spectra: InitialSpectrum[];
    private dynamics: DynamicSpectrum[] = [];
    private iffts: IFFT[] = [];

    readonly heightMap:   BaseTexture;  readonly displacementMap:   BaseTexture;  readonly gradientMap:   BaseTexture;
    readonly heightMap1:  BaseTexture;  readonly displacementMap1:  BaseTexture;  readonly gradientMap1:  BaseTexture;
    readonly heightMap2:  BaseTexture;  readonly displacementMap2:  BaseTexture;  readonly gradientMap2:  BaseTexture;
    readonly heightMap3:  BaseTexture;  readonly displacementMap3:  BaseTexture;  readonly gradientMap3:  BaseTexture;

    private elapsedSeconds = 60;
    public useWangTiles: boolean = false;

    constructor(name: string, spectra: InitialSpectrum[], scene: Scene, engine: WebGPUEngine) {
        if (Effect.ShadersStore["oceanVertexShader"] === undefined) Effect.ShadersStore["oceanVertexShader"] = vertex;
        if (Effect.ShadersStore["oceanFragmentShader"] === undefined) Effect.ShadersStore["oceanFragmentShader"] = fragment;

        super(name, scene, "ocean", {
            attributes: ["position", "normal", "uv"],
            uniforms: [
                "world", "worldView", "worldViewProjection", "view", "projection",
                "cameraPositionW", "lightDirection",
                "uTiles", "uAmps", "uGridStep",
                "showPerlinNoise", "uPerlinStrength",
                "showNormalMapOverlay", "showTileBorders", "showHexGrid", "showHexlMixing",
                "uGridStep", "uBlendSigma", "uLODSkip",
                "useWangTiles", "wangMapWidth", "wangMapHeight", "wangPadding", "uGridStep",
                "showWangColors"
            ],
            samplers: [
                "heightMap", "displacementMap",
                "heightMap1", "displacementMap1",
                "heightMap2", "displacementMap2",
                "heightMap3", "displacementMap3",
                "reflectionSampler", "depthSampler", "textureSampler",
                "normalMapOverlay",
                "wangSpectraMap"
            ]
        });

        this.spectra = spectra;
        this.textureSize = spectra[0].textureSize;

        for (let i = 0; i < 4; i++) {
            this.dynamics.push(new DynamicSpectrum(spectra[i], engine));
            this.iffts.push(new IFFT(engine, spectra[i].textureSize));
        }

        const mkTex = (name: string) => createStorageTexture(name, engine, this.textureSize, this.textureSize, Constants.TEXTUREFORMAT_RG);
        this.heightMap = mkTex("heightBuffer0");   this.displacementMap = mkTex("displacementBuffer0");   this.gradientMap = mkTex("gradientBuffer0");
        this.heightMap1 = mkTex("heightBuffer1");  this.displacementMap1 = mkTex("displacementBuffer1");  this.gradientMap1 = mkTex("gradientBuffer1");
        this.heightMap2 = mkTex("heightBuffer2");  this.displacementMap2 = mkTex("displacementBuffer2");  this.gradientMap2 = mkTex("gradientBuffer2");
        this.heightMap3 = mkTex("heightBuffer3");  this.displacementMap3 = mkTex("displacementBuffer3");  this.gradientMap3 = mkTex("gradientBuffer3");

        const setWrap = (t: BaseTexture) => { t.wrapU = Constants.TEXTURE_WRAP_ADDRESSMODE; t.wrapV = Constants.TEXTURE_WRAP_ADDRESSMODE; };
        setWrap(this.heightMap); setWrap(this.displacementMap); setWrap(this.gradientMap);
        setWrap(this.heightMap1); setWrap(this.displacementMap1); setWrap(this.gradientMap1);
        setWrap(this.heightMap2); setWrap(this.displacementMap2); setWrap(this.gradientMap2);
        setWrap(this.heightMap3); setWrap(this.displacementMap3); setWrap(this.gradientMap3);

        this.setTexture("heightMap", this.heightMap);       this.setTexture("displacementMap", this.displacementMap);
        this.setTexture("heightMap1", this.heightMap1);     this.setTexture("displacementMap1", this.displacementMap1);
        this.setTexture("heightMap2", this.heightMap2);     this.setTexture("displacementMap2", this.displacementMap2);
        this.setTexture("heightMap3", this.heightMap3);     this.setTexture("displacementMap3", this.displacementMap3);

        this.setFloat("uGridStep", 20);
        this.setFloat("uBlendSigma", 0.5);
        this.setFloat("uLODSkip", 0.0);
        this.setFloat("showPerlinNoise", 0.0);
        this.setFloat("uPerlinStrength", 0.5);

        const dummyData = new Uint8Array([0, 0, 0, 255]);
        const dummyTex = new RawTexture(dummyData, 1, 1, Constants.TEXTUREFORMAT_RGBA, scene, false, false, Constants.TEXTURE_NEAREST_SAMPLINGMODE);
        this.setTexture("wangSpectraMap", dummyTex);
        this.setFloat("useWangTiles", 0.0);
        this.setFloat("wangMapWidth", 1.0);
        this.setFloat("wangMapHeight", 1.0);
        this.setFloat("wangPadding", 1.0);
        this.setFloat("showWangColors", 0.0);

        this.depthRenderer = scene.enableDepthRenderer(scene.activeCamera, false, true);
        this.setTexture("depthSampler", this.depthRenderer.getDepthMap());
        this.screenRenderTarget = new RenderTargetTexture("screenTexture", { ratio: engine.getRenderWidth() / engine.getRenderHeight() }, scene);
        scene.customRenderTargets.push(this.screenRenderTarget);
        this.setTexture("textureSampler", this.screenRenderTarget);
        this.reflectionTexture = new CubeTexture("", scene, null, false, [TropicalSunnyDay_px, TropicalSunnyDay_py, TropicalSunnyDay_pz, TropicalSunnyDay_nx, TropicalSunnyDay_ny, TropicalSunnyDay_nz]);
        this.setTexture("reflectionSampler", this.reflectionTexture);
        this.setMatrix3x3("uTiles", new Float32Array([10,5,2, 0,0,0, 0,0,0]));
        this.setMatrix3x3("uAmps", new Float32Array([0.02,0.01,0.005, 0,0,0, 0,0,0]));
    }

    public setWangTiles(generator: WangTileGenerator, atlas: WangTileSpectrumAtlas, tileSet: WangTileSet): void {
        const scene = this.getScene();
        const mapW = generator.width;
        const mapH = generator.height;
        const PADDING = 4;
        const bigMapW = mapW * PADDING;
        const bigMapH = mapH * PADDING;
        const spectraData = new Uint8Array(bigMapW * bigMapH * 4);
        
        for (let y = 0; y < mapH; y++) {
            for (let x = 0; x < mapW; x++) {
                const tile = generator.getTileAt(x, y);
                for (let py = 0; py < PADDING; py++) {
                    for (let px = 0; px < PADDING; px++) {
                        const idx = ((y * PADDING + py) * bigMapW + (x * PADDING + px)) * 4;
                        spectraData[idx + 0] = tile[0];
                        spectraData[idx + 1] = tile[1];
                        spectraData[idx + 2] = tile[2];
                        spectraData[idx + 3] = tile[3];
                    }
                }
            }
        }
        
        const spectraTex = new RawTexture(spectraData, bigMapW, bigMapH, Constants.TEXTUREFORMAT_RGBA, scene, false, false, Constants.TEXTURE_NEAREST_SAMPLINGMODE);
        spectraTex.wrapU = Constants.TEXTURE_WRAP_ADDRESSMODE;
        spectraTex.wrapV = Constants.TEXTURE_WRAP_ADDRESSMODE;
        this.setTexture("wangSpectraMap", spectraTex);
        this.setFloat("wangMapWidth", bigMapW);
        this.setFloat("wangMapHeight", bigMapH);
        this.setFloat("wangPadding", PADDING);
        console.log('wangSpectraMap created:', bigMapW, 'x', bigMapH);
    }

    public enableWangTiles(): void { this.setFloat("useWangTiles", 1.0); this.useWangTiles = true; }
    public disableWangTiles(): void { this.setFloat("useWangTiles", 0.0); this.useWangTiles = false; }

    public setAllWaveParams(
        t00: number, t01: number, t02: number, a00: number, a01: number, a02: number,
        t10: number, t11: number, t12: number, a10: number, a11: number, a12: number,
        t20: number, t21: number, t22: number, a20: number, a21: number, a22: number
    ): void {
        this.setMatrix3x3("uTiles", new Float32Array([t00,t01,t02, t10,t11,t12, t20,t21,t22]));
        this.setMatrix3x3("uAmps", new Float32Array([a00,a01,a02, a10,a11,a12, a20,a21,a22]));
    }

    public update(deltaSeconds: number, lightDirection: Vector3) {
        this.elapsedSeconds += deltaSeconds;
        for (let i = 0; i < 4; i++) this.dynamics[i].generate(this.elapsedSeconds);
        this.iffts[0].applyToTexture(this.dynamics[0].ht, this.heightMap);
        this.iffts[0].applyToTexture(this.dynamics[0].dht, this.gradientMap);
        this.iffts[0].applyToTexture(this.dynamics[0].displacement, this.displacementMap);
        this.iffts[1].applyToTexture(this.dynamics[1].ht, this.heightMap1);
        this.iffts[1].applyToTexture(this.dynamics[1].dht, this.gradientMap1);
        this.iffts[1].applyToTexture(this.dynamics[1].displacement, this.displacementMap1);
        this.iffts[2].applyToTexture(this.dynamics[2].ht, this.heightMap2);
        this.iffts[2].applyToTexture(this.dynamics[2].dht, this.gradientMap2);
        this.iffts[2].applyToTexture(this.dynamics[2].displacement, this.displacementMap2);
        this.iffts[3].applyToTexture(this.dynamics[3].ht, this.heightMap3);
        this.iffts[3].applyToTexture(this.dynamics[3].dht, this.gradientMap3);
        this.iffts[3].applyToTexture(this.dynamics[3].displacement, this.displacementMap3);
        const others = this.getScene().meshes.filter(m => m.material !== this);
        this.depthRenderer.getDepthMap().renderList = others;
        this.screenRenderTarget.renderList = others;
        const cam = this.getScene().activeCamera;
        if (!cam) throw new Error("No active camera");
        this.setVector3("cameraPositionW", cam.globalPosition);
        this.setVector3("lightDirection", lightDirection);
    }

    public dispose(forceDisposeEffect?: boolean, forceDisposeTextures?: boolean, notBoundToMesh?: boolean) {
        this.dynamics.forEach(d => d.dispose());
        this.iffts.forEach(i => i.dispose());
        [this.heightMap, this.displacementMap, this.gradientMap, this.heightMap1, this.displacementMap1, this.gradientMap1,
         this.heightMap2, this.displacementMap2, this.gradientMap2, this.heightMap3, this.displacementMap3, this.gradientMap3]
            .forEach(t => t.dispose());
        super.dispose(forceDisposeEffect, forceDisposeTextures, notBoundToMesh);
    }
}