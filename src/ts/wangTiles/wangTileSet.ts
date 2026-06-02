export interface WangTileSet {
    name: string;
    numColors: number;
    tiles: number[][];
    tileCount: number;
    colors: number[][];
}

export function generateMinimalSet(numColors: number): number[][] {
    const tiles: number[][] = [];
    for (let c = 0; c < numColors; c++) {
        tiles.push([c, c, c, c]);
    }
    
    for (let a = 0; a < numColors; a++) {
        for (let b = 0; b < numColors; b++) {
            if (a !== b) {
                tiles.push([a, b, a, b]);
            }
        }
    }
    
    for (let a = 0; a < numColors; a++) {
        for (let b = 0; b < numColors; b++) {
            if (a !== b) {
                tiles.push([a, a, b, b]);
            }
        }
    }
    
    for (let start = 0; start < numColors; start++) {
        const a = start;
        const b = (start + 1) % numColors;
        const c = (start + 2) % numColors;
        tiles.push([a, b, c, a]);
    }
    
    return tiles;
}

export function generateFullSet(numColors: number): number[][] {
    const tiles: number[][] = [];
    
    for (let top = 0; top < numColors; top++) {
        for (let right = 0; right < numColors; right++) {
            for (let bottom = 0; bottom < numColors; bottom++) {
                for (let left = 0; left < numColors; left++) {
                    tiles.push([top, right, bottom, left]);
                }
            }
        }
    }
    
    return tiles;
}

export function createWangTileSet(
    tiles: number[][],
    numColors: number,
    name?: string,
    colors?: number[][]
): WangTileSet {
    return {
        name: name || `Custom ${tiles.length} tiles`,
        numColors,
        tiles,
        tileCount: tiles.length,
        colors: colors || generateColors(numColors),
    };
}

export function generateColors(numColors: number): number[][] {
    const colors: number[][] = [];
    for (let i = 0; i < numColors; i++) {
        const hue = (i / numColors) * 360;
        const rgb = hslToRgb(hue, 0.7, 0.6);
        colors.push([rgb[0], rgb[1], rgb[2], 1.0]);
    }
    return colors;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    h /= 360;
    
    if (s === 0) {
        return [l, l, l];
    }
    
    const hue2rgb = (p: number, q: number, t: number): number => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    
    return [
        hue2rgb(p, q, h + 1/3),
        hue2rgb(p, q, h),
        hue2rgb(p, q, h - 1/3),
    ];
}

export function areCompatibleH(tile1: number[], tile2: number[]): boolean {
    return tile1[1] === tile2[3];
}

export function areCompatibleV(tile1: number[], tile2: number[]): boolean {
    return tile1[2] === tile2[0];
}

export function findCompatibleRight(tileSet: WangTileSet, tileIdx: number): number[] {
    const tile = tileSet.tiles[tileIdx];
    const result: number[] = [];
    for (let i = 0; i < tileSet.tileCount; i++) {
        if (tileSet.tiles[i][3] === tile[1]) {
            result.push(i);
        }
    }
    return result;
}

export function findCompatibleBottom(tileSet: WangTileSet, tileIdx: number): number[] {
    const tile = tileSet.tiles[tileIdx];
    const result: number[] = [];
    for (let i = 0; i < tileSet.tileCount; i++) {
        if (tileSet.tiles[i][0] === tile[2]) {
            result.push(i);
        }
    }
    return result;
}