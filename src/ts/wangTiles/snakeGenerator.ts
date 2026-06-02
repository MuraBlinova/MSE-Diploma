import { WangTileSet, generateFullSet } from './wangTileSet';
import { WangTileGenerator } from './wangTileGenerator';

export class SnakeGenerator implements WangTileGenerator {
    public tileMap: Uint32Array;
    public readonly width: number;
    public readonly height: number;
    private tileSet: WangTileSet;
    private fullSet: number[][];
    public fallbackUsed: boolean = false;
    public fallbackCount: number = 0;
    
    private actualTiles: number[][];
    
    constructor(tileSet: WangTileSet, width: number = 20, height: number = 20) {
        this.tileSet = tileSet;
        this.width = width;
        this.height = height;
        this.tileMap = new Uint32Array(width * height);
        this.actualTiles = new Array(width * height);
        this.fullSet = generateFullSet(tileSet.numColors);
    }
    
    private getTile(idx: number): number[] {
        if (idx < this.tileSet.tileCount) {
            return this.tileSet.tiles[idx];
        }
        return this.fullSet[idx - this.tileSet.tileCount];
    }

    private getRightEdge(cellIdx: number): number {
        return this.actualTiles[cellIdx][1];
    }
    
    private getBottomEdge(cellIdx: number): number {
        return this.actualTiles[cellIdx][2];
    }
    
    private findTilesByEdge(edgeIndex: number, color: number): number[] {
        const result: number[] = [];
        for (let i = 0; i < this.tileSet.tileCount; i++) {
            if (this.tileSet.tiles[i][edgeIndex] === color) {
                result.push(i);
            }
        }
        return result;
    }
    
    private findTilesByTwoEdges(leftColor: number, topColor: number): number[] {
        const result: number[] = [];
        for (let i = 0; i < this.tileSet.tileCount; i++) {
            const tile = this.tileSet.tiles[i];
            if (tile[3] === leftColor && tile[0] === topColor) {
                result.push(i);
            }
        }
        return result;
    }
    
    private findFallbackByEdge(edgeIndex: number, color: number): number {
        const compatible: number[] = [];
        for (let i = 0; i < this.fullSet.length; i++) {
            if (this.fullSet[i][edgeIndex] === color) {
                compatible.push(i);
            }
        }
        this.fallbackUsed = true;
        this.fallbackCount++;
        return this.tileSet.tileCount + compatible[Math.floor(Math.random() * compatible.length)];
    }

    private findFallbackByTwoEdges(leftColor: number, topColor: number): number {
        const compatible: number[] = [];
        for (let i = 0; i < this.fullSet.length; i++) {
            const tile = this.fullSet[i];
            if (tile[3] === leftColor && tile[0] === topColor) {
                compatible.push(i);
            }
        }
        this.fallbackUsed = true;
        this.fallbackCount++;
        return this.tileSet.tileCount + compatible[Math.floor(Math.random() * compatible.length)];
    }
    
    public generate(): void {
        this.fallbackUsed = false;
        this.fallbackCount = 0;
        
        const total = this.tileSet.tileCount;
        
        this.tileMap[0] = Math.floor(Math.random() * total);
        this.actualTiles[0] = this.tileSet.tiles[this.tileMap[0]];
        
        for (let x = 1; x < this.width; x++) {
            const idx = x;
            const requiredLeftColor = this.getRightEdge(idx - 1);
            
            let compatible = this.findTilesByEdge(3, requiredLeftColor);
            
            if (compatible.length === 0) {
                console.warn(`No tile in custom set with left=${requiredLeftColor} at (${x},0), using fallback`);
                this.tileMap[idx] = this.findFallbackByEdge(3, requiredLeftColor);
            } else {
                this.tileMap[idx] = compatible[Math.floor(Math.random() * compatible.length)];
            }
            this.actualTiles[idx] = this.getTile(this.tileMap[idx]);
        }
        
        for (let y = 1; y < this.height; y++) {
            
            const idx0 = y * this.width;
            const topIdx = (y - 1) * this.width;
            const requiredTopColor = this.getBottomEdge(topIdx);
            
            let compatibleTop = this.findTilesByEdge(0, requiredTopColor);
            
            if (compatibleTop.length === 0) {
                console.warn(`No tile in custom set with top=${requiredTopColor} at (0,${y}), using fallback`);
                this.tileMap[idx0] = this.findFallbackByEdge(0, requiredTopColor);
            } else {
                this.tileMap[idx0] = compatibleTop[Math.floor(Math.random() * compatibleTop.length)];
            }
            this.actualTiles[idx0] = this.getTile(this.tileMap[idx0]);
            
            for (let x = 1; x < this.width; x++) {
                const idx = y * this.width + x;
                const requiredLeftColor = this.getRightEdge(idx - 1);
                const requiredTopColor = this.getBottomEdge(idx - this.width);
                
                let compatible = this.findTilesByTwoEdges(requiredLeftColor, requiredTopColor);
                
                if (compatible.length === 0) {
                    console.warn(
                        `No tile in custom set with left=${requiredLeftColor}, top=${requiredTopColor} ` +
                        `at (${x},${y}), using fallback`
                    );
                    this.tileMap[idx] = this.findFallbackByTwoEdges(requiredLeftColor, requiredTopColor);
                } else {
                    this.tileMap[idx] = compatible[Math.floor(Math.random() * compatible.length)];
                }
                this.actualTiles[idx] = this.getTile(this.tileMap[idx]);
            }
        }
        let customCount = 0;
        let fallbackCount = 0;
        for (let i = 0; i < this.tileMap.length; i++) {
            if (this.tileMap[i] < this.tileSet.tileCount) {
                customCount++;
            } else {
                fallbackCount++;
            }
        }
        const total_ = this.width * this.height;
        const fallbackPercent = (fallbackCount / total_) * 100;

        console.log('SNAKE GENERATOR REPORT');
        console.log('     Custom tiles:', customCount/total_);
        console.log('     Fallback:', fallbackCount/total_);
    }

    public getTileAt(x: number, y: number): number[] {
        const idx = y * this.width + x;
        return this.actualTiles[idx];
    }
}