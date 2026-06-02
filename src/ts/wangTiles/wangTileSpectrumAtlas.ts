export class WangTileSpectrumAtlas {
    public readonly canvas: HTMLCanvasElement;
    public readonly ctx: CanvasRenderingContext2D;
    public readonly tileRes: number;
    public readonly atlasSize: number;
    public readonly numColors: number;

    constructor(numColors: number, tileRes: number = 64) {
        this.numColors = numColors;
        this.tileRes = tileRes;
        this.atlasSize = Math.ceil(Math.sqrt(numColors ** 4));
        const size = this.atlasSize * tileRes;
        this.canvas = document.createElement('canvas');
        this.canvas.width = size;
        this.canvas.height = size;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
        this.bakeAll();
    }

    private drawTile(tileX: number, tileY: number, edges: number[]): void {
        const px = tileX * this.tileRes;
        const py = tileY * this.tileRes;
        const s = this.tileRes;
        const ctx = this.ctx;
        const imageData = ctx.createImageData(s, s);
        const avgWeight = 0.25;
        for (let y = 0; y < s; y++) {
            for (let x = 0; x < s; x++) {
                const u = x / s, v = y / s;
                const idx = (y * s + x) * 4;
                const dTop = v, dRight = 1.0 - u, dBottom = 1.0 - v, dLeft = u;
                const sigma = 0.15;
                const wTop = Math.exp(-dTop * dTop / (2 * sigma * sigma));
                const wRight = Math.exp(-dRight * dRight / (2 * sigma * sigma));
                const wBottom = Math.exp(-dBottom * dBottom / (2 * sigma * sigma));
                const wLeft = Math.exp(-dLeft * dLeft / (2 * sigma * sigma));
                const total = wTop + wRight + wBottom + wLeft;
                const edgeInfluence = Math.min(1.0, total * 50.0);
                const neutralInfluence = 1.0 - edgeInfluence;
                let fTop = (wTop / total) * edgeInfluence + avgWeight * neutralInfluence;
                let fRight = (wRight / total) * edgeInfluence + avgWeight * neutralInfluence;
                let fBottom = (wBottom / total) * edgeInfluence + avgWeight * neutralInfluence;
                let fLeft = (wLeft / total) * edgeInfluence + avgWeight * neutralInfluence;
                const totalF = fTop + fRight + fBottom + fLeft;
                if (totalF > 0.0001) { fTop /= totalF; fRight /= totalF; fBottom /= totalF; fLeft /= totalF; }
                else { fTop = fRight = fBottom = fLeft = 0.25; }
                imageData.data[idx + 0] = Math.round(fTop * 255);
                imageData.data[idx + 1] = Math.round(fRight * 255);
                imageData.data[idx + 2] = Math.round(fBottom * 255);
                imageData.data[idx + 3] = Math.round(fLeft * 255);
            }
        }
        ctx.putImageData(imageData, px, py);
    }

    private bakeAll(): void {
        const start = performance.now();
        const total = this.numColors ** 4;
        for (let top = 0; top < this.numColors; top++)
            for (let right = 0; right < this.numColors; right++)
                for (let bottom = 0; bottom < this.numColors; bottom++)
                    for (let left = 0; left < this.numColors; left++) {
                        const idx = top * this.numColors**3 + right * this.numColors**2 + bottom * this.numColors + left;
                        this.drawTile(idx % this.atlasSize, Math.floor(idx / this.atlasSize), [top, right, bottom, left]);
                    }
        console.log('Spectrum atlas baked in', performance.now() - start, 'ms');
    }

    public createDebugPreview(colors: number[][]): HTMLCanvasElement {
        const debugCanvas = document.createElement('canvas');
        debugCanvas.width = this.canvas.width;
        debugCanvas.height = this.canvas.height;
        const ctx = debugCanvas.getContext('2d')!;
        ctx.fillStyle = '#333';
        ctx.fillRect(0, 0, debugCanvas.width, debugCanvas.height);
        const avgWeight = 0.25;
        for (let top = 0; top < this.numColors; top++)
            for (let right = 0; right < this.numColors; right++)
                for (let bottom = 0; bottom < this.numColors; bottom++)
                    for (let left = 0; left < this.numColors; left++) {
                        const tileIdx = top * this.numColors**3 + right * this.numColors**2 + bottom * this.numColors + left;
                        const ax = tileIdx % this.atlasSize, ay = Math.floor(tileIdx / this.atlasSize);
                        const px = ax * this.tileRes, py = ay * this.tileRes;
                        const ct = colors[top], cr = colors[right], cb = colors[bottom], cl = colors[left];
                        const imageData = ctx.createImageData(this.tileRes, this.tileRes);
                        for (let y = 0; y < this.tileRes; y++)
                            for (let x = 0; x < this.tileRes; x++) {
                                const u = x / this.tileRes, v = y / this.tileRes;
                                const idx = (y * this.tileRes + x) * 4;
                                const dTop = v, dRight = 1.0 - u, dBottom = 1.0 - v, dLeft = u;
                                const sigma = 0.15;
                                const wTop = Math.exp(-dTop * dTop / (2 * sigma * sigma));
                                const wRight = Math.exp(-dRight * dRight / (2 * sigma * sigma));
                                const wBottom = Math.exp(-dBottom * dBottom / (2 * sigma * sigma));
                                const wLeft = Math.exp(-dLeft * dLeft / (2 * sigma * sigma));
                                const total = wTop + wRight + wBottom + wLeft;
                                const edgeInfluence = Math.min(1.0, total * 50.0);
                                const neutralInfluence = 1.0 - edgeInfluence;
                                let fTop = (wTop / total) * edgeInfluence + avgWeight * neutralInfluence;
                                let fRight = (wRight / total) * edgeInfluence + avgWeight * neutralInfluence;
                                let fBottom = (wBottom / total) * edgeInfluence + avgWeight * neutralInfluence;
                                let fLeft = (wLeft / total) * edgeInfluence + avgWeight * neutralInfluence;
                                const totalF = fTop + fRight + fBottom + fLeft;
                                fTop /= totalF; fRight /= totalF; fBottom /= totalF; fLeft /= totalF;
                                const r = ct[0] * fTop + cr[0] * fRight + cb[0] * fBottom + cl[0] * fLeft;
                                const g = ct[1] * fTop + cr[1] * fRight + cb[1] * fBottom + cl[1] * fLeft;
                                const b = ct[2] * fTop + cr[2] * fRight + cb[2] * fBottom + cl[2] * fLeft;
                                imageData.data[idx + 0] = Math.min(255, Math.max(0, Math.round(r * 255)));
                                imageData.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g * 255)));
                                imageData.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b * 255)));
                                imageData.data[idx + 3] = 255;
                            }
                        ctx.putImageData(imageData, px, py);
                    }
        return debugCanvas;
    }

    public toDataURL(): string { return this.canvas.toDataURL(); }

    public getTileUV(tileIdx: number): { u0: number; v0: number; u1: number; v1: number } {
        const ax = tileIdx % this.atlasSize;
        const ay = Math.floor(tileIdx / this.atlasSize);
        const total = this.atlasSize * this.tileRes;
        return { u0: (ax * this.tileRes) / total, v0: (ay * this.tileRes) / total, u1: ((ax + 1) * this.tileRes) / total, v1: ((ay + 1) * this.tileRes) / total };
    }
}