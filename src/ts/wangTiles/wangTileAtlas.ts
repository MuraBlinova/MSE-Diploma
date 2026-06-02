export class WangTileAtlas {
    public readonly canvas: HTMLCanvasElement;
    public readonly ctx: CanvasRenderingContext2D;
    public readonly tileRes: number;
    public readonly atlasSize: number;
    public readonly numColors: number;

    private colorMap: number[][];

    constructor(numColors: number, tileRes: number = 64) {
        this.numColors = numColors;
        this.tileRes = tileRes;
        this.atlasSize = Math.ceil(Math.sqrt(numColors ** 4));

        this.colorMap = [];
        for (let i = 0; i < numColors; i++) {
            const hue = (i / numColors) * 360;
            this.colorMap.push(this.hslToRgb(hue, 0.7, 0.6));
        }

        const size = this.atlasSize * tileRes;
        this.canvas = document.createElement('canvas');
        this.canvas.width = size;
        this.canvas.height = size;
        this.ctx = this.canvas.getContext('2d')!;

        this.bakeAll();
    }

    private hslToRgb(h: number, s: number, l: number): number[] {
        h /= 360;
        let r: number, g: number, b: number;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p: number, q: number, t: number) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)];
    }

    private drawTile(tileX: number, tileY: number, edges: number[]): void {
        const [top, right, bottom, left] = edges;
        const px = tileX * this.tileRes;
        const py = tileY * this.tileRes;
        const s = this.tileRes;

        const ctx = this.ctx;
        const imageData = ctx.createImageData(s, s);

        const ct = this.colorMap[top];
        const cr = this.colorMap[right];
        const cb = this.colorMap[bottom];
        const cl = this.colorMap[left];

        const avgR = (ct[0] + cr[0] + cb[0] + cl[0]) / 4;
        const avgG = (ct[1] + cr[1] + cb[1] + cl[1]) / 4;
        const avgB = (ct[2] + cr[2] + cb[2] + cl[2]) / 4;

        for (let y = 0; y < s; y++) {
            for (let x = 0; x < s; x++) {
                const u = x / s;
                const v = y / s;
                const idx = (y * s + x) * 4;

                const dTop = v;
                const dRight = 1.0 - u;
                const dBottom = 1.0 - v;
                const dLeft = u;

                const sigma = 0.15;
                const wTop = Math.exp(-dTop * dTop / (2 * sigma * sigma));
                const wRight = Math.exp(-dRight * dRight / (2 * sigma * sigma));
                const wBottom = Math.exp(-dBottom * dBottom / (2 * sigma * sigma));
                const wLeft = Math.exp(-dLeft * dLeft / (2 * sigma * sigma));

                const total = wTop + wRight + wBottom + wLeft;

                const edgeInfluence = Math.min(1.0, total * 50.0);

                const r = (ct[0] * wTop + cr[0] * wRight + cb[0] * wBottom + cl[0] * wLeft) / total * edgeInfluence + avgR * (1.0 - edgeInfluence);
                const g = (ct[1] * wTop + cr[1] * wRight + cb[1] * wBottom + cl[1] * wLeft) / total * edgeInfluence + avgG * (1.0 - edgeInfluence);
                const b = (ct[2] * wTop + cr[2] * wRight + cb[2] * wBottom + cl[2] * wLeft) / total * edgeInfluence + avgB * (1.0 - edgeInfluence);

                imageData.data[idx + 0] = Math.min(255, Math.max(0, Math.round(r)));
                imageData.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
                imageData.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
                imageData.data[idx + 3] = 255;
            }
        }

        ctx.putImageData(imageData, px, py);

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
    }

    private bakeAll(): void {
        const start = performance.now();
        const total = this.numColors ** 4;
        console.log('Baking atlas:',total, 'tiles');

        for (let top = 0; top < this.numColors; top++) {
            for (let right = 0; right < this.numColors; right++) {
                for (let bottom = 0; bottom < this.numColors; bottom++) {
                    for (let left = 0; left < this.numColors; left++) {
                        const idx = top * this.numColors**3 +
                                   right * this.numColors**2 +
                                   bottom * this.numColors +
                                   left;
                        const ax = idx % this.atlasSize;
                        const ay = Math.floor(idx / this.atlasSize);
                        this.drawTile(ax, ay, [top, right, bottom, left]);
                    }
                }
            }
        }

        console.log('Atlas baked in', performance.now() - start, 'ms');
    }

    public toDataURL(): string {
        return this.canvas.toDataURL();
    }

    public getTileUV(tileIdx: number): { u0: number; v0: number; u1: number; v1: number } {
        const ax = tileIdx % this.atlasSize;
        const ay = Math.floor(tileIdx / this.atlasSize);
        const total = this.atlasSize * this.tileRes;

        return {
            u0: (ax * this.tileRes) / total,
            v0: (ay * this.tileRes) / total,
            u1: ((ax + 1) * this.tileRes) / total,
            v1: ((ay + 1) * this.tileRes) / total,
        };
    }
}