export interface WangTileGenerator {
    tileMap: Uint32Array;
    width: number;
    height: number;

    getTileAt(x: number, y: number): number[];
    generate(): void;
}