import { describe, it, expect } from "vitest";
import {
    getColorDistance,
    calculateAverageColorFromPixels,
    findBestTileIndex,
    generateMosaicGridIndices,
    calculateCoverCrop,
    calculateGridDimensions,
    clampFinite,
    type ColorRgb,
} from "../utils/mosaicArt";

describe("mosaicArt utility functions", () => {
    describe("getColorDistance", () => {
        it("同一色の場合は距離が0であること", () => {
            const dist = getColorDistance(100, 150, 200, 100, 150, 200);
            expect(dist).toBe(0);
        });

        it("白と黒の距離が正の有限値であること", () => {
            const dist = getColorDistance(0, 0, 0, 255, 255, 255);
            expect(dist).toBeGreaterThan(500);
            expect(Number.isFinite(dist)).toBe(true);
        });

        it("赤と緑の距離が近い色より遠いこと", () => {
            const distRedGreen = getColorDistance(255, 0, 0, 0, 255, 0);
            const distRedDarkRed = getColorDistance(255, 0, 0, 200, 0, 0);
            expect(distRedGreen).toBeGreaterThan(distRedDarkRed);
        });
    });

    describe("calculateAverageColorFromPixels", () => {
        it("空データの場合はデフォルト色（灰色）を返すこと", () => {
            const avg = calculateAverageColorFromPixels([], 0);
            expect(avg).toEqual({ r: 128, g: 128, b: 128 });
        });

        it("単一ピクセルの色を正しく計算すること", () => {
            // RGBA: 255, 100, 50, 255
            const pixels = [255, 100, 50, 255];
            const avg = calculateAverageColorFromPixels(pixels, 1);
            expect(avg).toEqual({ r: 255, g: 100, b: 50 });
        });

        it("複数ピクセルの平均を正しく算出すること", () => {
            // 2ピクセル: (100, 0, 0, 255) と (200, 0, 0, 255)
            const pixels = [100, 0, 0, 255, 200, 0, 0, 255];
            const avg = calculateAverageColorFromPixels(pixels, 2);
            expect(avg).toEqual({ r: 150, g: 0, b: 0 });
        });

        it("透明ピクセルは白背景としてブレンドされること", () => {
            // 完全透明ピクセル (0, 0, 0, 0)
            const pixels = [0, 0, 0, 0];
            const avg = calculateAverageColorFromPixels(pixels, 1);
            expect(avg).toEqual({ r: 255, g: 255, b: 255 });
        });
    });

    describe("findBestTileIndex", () => {
        const tiles = [
            { avgColor: { r: 255, g: 0, b: 0 } }, // 0: 赤
            { avgColor: { r: 0, g: 255, b: 0 } }, // 1: 緑
            { avgColor: { r: 0, g: 0, b: 255 } }, // 2: 青
        ];

        it("最も近い色のタイルインデックスを選択すること", () => {
            const target: ColorRgb = { r: 240, g: 10, b: 10 };
            const index = findBestTileIndex(target, tiles);
            expect(index).toBe(0); // 赤が最も近い
        });

        it("青に近い目標色では青タイルが選ばれること", () => {
            const target: ColorRgb = { r: 10, g: 10, b: 230 };
            const index = findBestTileIndex(target, tiles);
            expect(index).toBe(2); // 青が最も近い
        });

        it("回避インデックスに指定されている場合はペナルティにより他が選ばれること", () => {
            // 赤とわずかに赤に近いが緑もそこそこ近いケース
            const target: ColorRgb = { r: 220, g: 200, b: 0 };
            // 通常なら赤か緑
            const normal = findBestTileIndex(target, tiles);
            // その色を avoid に指定
            const avoided = findBestTileIndex(target, tiles, {
                avoidIndices: [normal],
            });
            expect(avoided).not.toBe(normal);
        });

        it("タイルが空の場合は-1を返すこと", () => {
            const index = findBestTileIndex({ r: 0, g: 0, b: 0 }, []);
            expect(index).toBe(-1);
        });
    });

    describe("generateMosaicGridIndices", () => {
        const tiles = [
            { avgColor: { r: 255, g: 0, b: 0 } }, // 0: 鮮明な赤
            { avgColor: { r: 220, g: 30, b: 30 } }, // 1: やや暗めの赤
            { avgColor: { r: 0, g: 255, b: 0 } }, // 2: 緑
        ];

        it("グリッド全体のセル数分インデックスを生成すること", () => {
            const cols = 4;
            const rows = 3;
            const targetCells: ColorRgb[] = new Array(cols * rows).fill({
                r: 255,
                g: 0,
                b: 0,
            });

            const grid = generateMosaicGridIndices(targetCells, cols, rows, tiles, {
                avoidAdjacent: false,
                duplicatePenaltyWeight: 0,
            });

            expect(grid.length).toBe(12);
            // ペナルティなしなら全て最も近い赤(0)が選ばれる
            expect(grid.every((idx) => idx === 0)).toBe(true);
        });

        it("avoidAdjacentが有効な場合、隣接セルで異なる画像が優先されること", () => {
            const cols = 2;
            const rows = 2;
            const targetCells: ColorRgb[] = new Array(4).fill({
                r: 240,
                g: 10,
                b: 10,
            });

            const grid = generateMosaicGridIndices(targetCells, cols, rows, tiles, {
                avoidAdjacent: true,
                duplicatePenaltyWeight: 2,
            });

            // 隣接セル（0と1、0と2）が同一にならないよう赤系2種で分散される
            expect(grid[1]).not.toBe(grid[0]);
        });
    });

    describe("calculateCoverCrop", () => {
        it("同じアスペクト比の場合は全領域を返すこと", () => {
            const crop = calculateCoverCrop(100, 100, 200, 200);
            expect(crop).toEqual({ sx: 0, sy: 0, sw: 100, sh: 100 });
        });

        it("元画像が横長の場合、左右が切り抜かれること", () => {
            // 元画像 200x100 (2:1)、目標 100x100 (1:1)
            const crop = calculateCoverCrop(200, 100, 100, 100);
            expect(crop.sw).toBe(100);
            expect(crop.sh).toBe(100);
            expect(crop.sx).toBe(50); // (200 - 100) / 2
            expect(crop.sy).toBe(0);
        });

        it("元画像が縦長の場合、上下が切り抜かれること", () => {
            // 元画像 100x200 (1:2)、目標 100x100 (1:1)
            const crop = calculateCoverCrop(100, 200, 100, 100);
            expect(crop.sw).toBe(100);
            expect(crop.sh).toBe(100);
            expect(crop.sx).toBe(0);
            expect(crop.sy).toBe(50); // (200 - 100) / 2
        });
    });

    describe("calculateGridDimensions & clampFinite", () => {
        it("タイル形状に応じて行数が正しくスケーリングされること", () => {
            const square = calculateGridDimensions(1000, 1000, 40, "square");
            expect(square.cols).toBe(40);
            expect(square.rows).toBe(40);

            const landscape = calculateGridDimensions(1000, 1000, 40, "landscape");
            expect(landscape.cols).toBe(40);
            expect(landscape.rows).toBe(53);

            const portrait = calculateGridDimensions(1000, 1000, 40, "portrait");
            expect(portrait.cols).toBe(40);
            expect(portrait.rows).toBe(30);

            const highCols = calculateGridDimensions(1000, 1000, 200, "square");
            expect(highCols.cols).toBe(200);
            expect(highCols.rows).toBe(200);
        });

        it("clampFinite が NaN や範囲外数値を安全に正規化すること", () => {
            expect(clampFinite(NaN, 0, 60, 20)).toBe(20);
            expect(clampFinite(-5, 0, 60, 20)).toBe(0);
            expect(clampFinite(999, 0, 60, 20)).toBe(60);
        });
    });

    describe("noReuse option", () => {
        it("タイル数 >= セル数の場合、noReuse: true で同一画像が一切再利用されないこと", () => {
            const tiles = [
                { avgColor: { r: 255, g: 0, b: 0 } },
                { avgColor: { r: 250, g: 10, b: 10 } },
                { avgColor: { r: 0, g: 255, b: 0 } },
                { avgColor: { r: 0, g: 0, b: 255 } },
            ];
            const targetCells = [
                { r: 255, g: 0, b: 0 },
                { r: 255, g: 0, b: 0 },
                { r: 0, g: 255, b: 0 },
                { r: 0, g: 0, b: 255 },
            ];

            const indices = generateMosaicGridIndices(targetCells, 2, 2, tiles, {
                noReuse: true,
            });
            expect(indices.length).toBe(4);
            expect(new Set(indices).size).toBe(4);
        });

        it("タイル数 < セル数の場合でも、最小使用回数から均等に選出されること", () => {
            const tiles = [
                { avgColor: { r: 255, g: 0, b: 0 } },
                { avgColor: { r: 0, g: 0, b: 255 } },
            ];
            const targetCells = [
                { r: 255, g: 0, b: 0 },
                { r: 255, g: 0, b: 0 },
                { r: 255, g: 0, b: 0 },
                { r: 255, g: 0, b: 0 },
            ];

            const indices = generateMosaicGridIndices(targetCells, 2, 2, tiles, {
                noReuse: true,
            });
            const count0 = indices.filter((i) => i === 0).length;
            const count1 = indices.filter((i) => i === 1).length;
            expect(count0).toBe(2);
            expect(count1).toBe(2);
        });
    });
});
