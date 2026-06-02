import { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { SnakeGenerator } from "./snakeGenerator";
import { WFCGenerator } from "./wfcGenerator";
import { WangTileAtlas } from "./wangTileAtlas";

export type GeneratorType = SnakeGenerator | WFCGenerator;

export class WangTileAtlasRenderer {
    public mesh: Mesh;
    public material: ShaderMaterial;
    private scene: Scene;
    private generator: GeneratorType;
    private atlas: WangTileAtlas;
    private mapSize: number;
    private dynamicTex: DynamicTexture;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    
    constructor(
        scene: Scene,
        generator: GeneratorType,
        atlas: WangTileAtlas,
        mapSize: number = 10,
        tileSize: number = 5.0
    ) {
        this.scene = scene;
        this.generator = generator;
        this.atlas = atlas;
        this.mapSize = mapSize;
        
        const texSize = 1024;
        this.canvas = document.createElement('canvas');
        this.canvas.width = texSize;
        this.canvas.height = texSize;
        this.ctx = this.canvas.getContext('2d')!;
        
        this.dynamicTex = new DynamicTexture("wangAtlasTex", this.canvas, scene, false);
        
        this.assembleTexture();
        
        this.material = new ShaderMaterial("wangAtlasMat", scene, "wangAtlas", {
            attributes: ["position", "normal", "uv"],
            uniforms: ["world", "worldView", "worldViewProjection"],
            samplers: ["textureSampler"],
            needAlphaBlending: false,
            needAlphaTesting: false,
        });
        
        this.material.setTexture("textureSampler", this.dynamicTex);
        
        this.mesh = MeshBuilder.CreateGround("wangAtlasPlane", {
            width: mapSize * tileSize,
            height: mapSize * tileSize,
            subdivisions: 1,
        }, scene);
        this.mesh.position.y = 2;
        this.mesh.material = this.material;
        this.mesh.setEnabled(false);
    }
    
    private assembleTexture(): void {
        const ctx = this.ctx;
        const texSize = this.canvas.width;
        const tilePx = texSize / this.mapSize;
        
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, texSize, texSize);

        ctx.save();
        ctx.translate(0, texSize);
        ctx.scale(1, -1);
        
        for (let y = 0; y < this.mapSize; y++) {
            for (let x = 0; x < this.mapSize; x++) {
                const tile = this.generator.getTileAt(x, y);
                const [top, right, bottom, left] = tile;
                
                const tileIdx = top * this.atlas.numColors**3 + 
                            right * this.atlas.numColors**2 + 
                            bottom * this.atlas.numColors + 
                            left;
                
                const uv = this.atlas.getTileUV(tileIdx);
                
                const dx = x * tilePx;
                const dy = y * tilePx;
                
                ctx.drawImage(
                    this.atlas.canvas,
                    uv.u0 * this.atlas.canvas.width,
                    uv.v0 * this.atlas.canvas.height,
                    this.atlas.tileRes,
                    this.atlas.tileRes,
                    dx, dy, tilePx, tilePx
                );
            }
        }
        
        this.dynamicTex.update();
    }
    
    public rebuild(): void {
        this.assembleTexture();
    }
    
    public toggle(): boolean {
        const enabled = !this.mesh.isEnabled();
        this.mesh.setEnabled(enabled);
        return enabled;
    }
    
    public dispose(): void {
        this.mesh.dispose();
        this.dynamicTex.dispose();
        this.material.dispose();
    }
}
