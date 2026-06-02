import { WangTileSet, generateFullSet } from './wangTileSet';
import { WangTileGenerator } from './wangTileGenerator';

export class WFCGenerator implements WangTileGenerator {
    public tileMap: Uint32Array;
    public readonly width: number;
    public readonly height: number;
    private tileSet: WangTileSet;
    private fullSet: number[][];
    public fallbackCount: number = 0;
    private actualTiles: number[][];
    
    public maxBacktrackDepth: number = 50;
    
    public timeout: number = 5000;
    
    public stats: {
        totalTiles: number;
        customTilesUsed: number;
        fallbackTilesUsed: number;
        customPercent: number;
        fallbackPercent: number;
        generationTimeMs: number;
    } = {
        totalTiles: 0,
        customTilesUsed: 0,
        fallbackTilesUsed: 0,
        customPercent: 0,
        fallbackPercent: 0,
        generationTimeMs: 0,
    };
    
    constructor(tileSet: WangTileSet, width: number = 20, height: number = 20) {
        this.tileSet = tileSet;
        this.width = width;
        this.height = height;
        this.tileMap = new Uint32Array(width * height);
        this.actualTiles = new Array(width * height);
        this.fullSet = generateFullSet(tileSet.numColors);
    }
    
    public getTileAt(x: number, y: number): number[] {
        return this.actualTiles[y * this.width + x];
    }
    
    private getCompatible(x: number, y: number, useFullSet: boolean): number[] {
        const result: number[] = [];
        const tiles = useFullSet ? this.fullSet : this.tileSet.tiles;
        
        for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i];
            let ok = true;
            
            if (x > 0) {
                const leftTile = this.actualTiles[y * this.width + (x - 1)];
                if (tile[3] !== leftTile[1]) ok = false;
            }
            
            if (y > 0) {
                const topTile = this.actualTiles[(y - 1) * this.width + x];
                if (tile[0] !== topTile[2]) ok = false;
            }
            
            if (ok) result.push(i);
        }
        
        return result;
    }

    private backtrack(index: number, depth: number, startTime: number): boolean {
        if (performance.now() - startTime > this.timeout) return false;
        if (index >= this.width * this.height) return true;
        if (depth > this.maxBacktrackDepth) return false;
        
        const x = index % this.width;
        const y = Math.floor(index / this.width);
        
        let compatible = this.getCompatible(x, y, false);
        this.shuffle(compatible);
        
        for (const tileIdx of compatible) {
            this.tileMap[index] = tileIdx;
            this.actualTiles[index] = this.tileSet.tiles[tileIdx];
            
            if (this.backtrack(index + 1, depth, startTime)) {
                return true;
            }
        }
        
        if (depth === 0) {
            compatible = this.getCompatible(x, y, true);
            this.shuffle(compatible);
            
            for (const tileIdx of compatible) {
                this.tileMap[index] = this.tileSet.tileCount + tileIdx;
                this.actualTiles[index] = this.fullSet[tileIdx];
                this.fallbackCount++;
                
                if (this.backtrack(index + 1, depth + 1, startTime)) {
                    return true;
                }
                
                this.fallbackCount--;
            }
        }
        
        this.tileMap[index] = 0;
        return false;
    }
    
    private greedy(): void {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = y * this.width + x;
                let compatible = this.getCompatible(x, y, false);
                
                if (compatible.length === 0) {
                    compatible = this.getCompatible(x, y, true);
                    if (compatible.length > 0) {
                        const fallbackIdx = compatible[Math.floor(Math.random() * compatible.length)];
                        this.tileMap[idx] = this.tileSet.tileCount + fallbackIdx;
                        this.actualTiles[idx] = this.fullSet[fallbackIdx];
                        this.fallbackCount++;
                    }
                } else {
                    this.tileMap[idx] = compatible[Math.floor(Math.random() * compatible.length)];
                    this.actualTiles[idx] = this.tileSet.tiles[this.tileMap[idx]];
                }
            }
        }
    }
    
    private calculateStats(generationTimeMs: number): void {
        const total = this.width * this.height;
        let customCount = 0;
        let fallbackCount = 0;
        
        for (let i = 0; i < this.tileMap.length; i++) {
            if (this.tileMap[i] < this.tileSet.tileCount) {
                customCount++;
            } else {
                fallbackCount++;
            }
        }
        
        this.stats = {
            totalTiles: total,
            customTilesUsed: customCount,
            fallbackTilesUsed: fallbackCount,
            customPercent: (customCount / total) * 100,
            fallbackPercent: (fallbackCount / total) * 100,
            generationTimeMs,
        };
    }
    

    private printStats(): void {
        const s = this.stats;
        
        console.log('WANG TILE GENERATION REPORT');
        console.log('     Map size:', s.totalTiles, 'tiles', this.width + 'x' + this.height);
        console.log('     Custom set:', this.tileSet.tileCount, 'tiles,', this.tileSet.numColors, 'colors');
        console.log('     Full set:', this.fullSet.length, 'tiles');
        console.log('     Custom tiles:', s.customTilesUsed, '(' + s.customPercent.toFixed(1) + '%)');
        console.log('     Fallback:', s.fallbackTilesUsed, '(' + s.fallbackPercent.toFixed(1) + '%)');
        console.log('     Time:', s.generationTimeMs.toFixed(0) + 'ms');
        
        if (s.fallbackPercent === 0) {
            console.log('     All tiles from custom set');
        } else if (s.fallbackPercent < 1) {
            console.log('     <1% fallback');
        } else {
            console.log('    ',s.fallbackPercent + '% fallback');
        }
    }
    
    
    public generate(): void {
        const startTime = performance.now();
        this.fallbackCount = 0;
        
        const success = this.backtrack(0, 0, startTime);
        const elapsed = performance.now() - startTime;
        
        if (!success) {
            this.fallbackCount = 0;
            this.greedy();
            const greedyElapsed = performance.now() - startTime;
            this.calculateStats(greedyElapsed);
        } else {
            this.calculateStats(elapsed);
        }
        this.printStats();
    }
    
    private shuffle(arr: number[]): void {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
}