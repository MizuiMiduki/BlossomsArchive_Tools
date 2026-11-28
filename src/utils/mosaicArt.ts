/**
 * モザイクアート（フォトモザイク）生成ユーティリティ
 *
 * ユーザー指定のターゲット画像に対して、知覚色差（Redmean）と重複ペナルティを用いて
 * 最適な構成画像（タイル画像群）を割り当てます。
 */

export type TileAspectRatio = "square" | "landscape" | "portrait";

export interface ColorRgb {
    r: number;
    g: number;
    b: number;
}

export interface MosaicTile {
    id: string;
    name: string;
    avgColor: ColorRgb;
    source?: CanvasImageSource;
    previewUrl: string;
}

export interface MosaicMatchOptions {
    /** 隣接するセル（直前・直上）と同じ画像の連続配置を回避するか */
    avoidAdjacent?: boolean;
    /** 画像ごとの重複使用に対するペナルティの重み (0: 重複自由, 1: 弱, 2: 中, 3: 強) */
    duplicatePenaltyWeight?: number;
    /** 同一画像の再利用を禁止するか（画像数 >= セル数 の場合は完全1回限り、不足時は最小使用回数から選出） */
    noReuse?: boolean;
}

export interface MosaicConfig extends MosaicMatchOptions {
    /** 横方向のタイル分割数 (例: 20〜120) */
    columns: number;
    /** 出力画像の横幅 (px) */
    outputWidth: number;
}

/**
 * 人間の視覚感度（Redmean 近似式）に基づく 2 つの RGB 色の知覚的色差（距離）を計算する。
 * ユークリッド距離よりも人間の色弁別能（特に緑色や明度の感度）を正確に反映します。
 */
export function getColorDistance(
    r1: number,
    g1: number,
    b1: number,
    r2: number,
    g2: number,
    b2: number,
): number {
    const rMean = (r1 + r2) / 2;
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    const weightR = 2 + rMean / 256;
    const weightG = 4.0;
    const weightB = 2 + (255 - rMean) / 256;
    return Math.sqrt(weightR * dr * dr + weightG * dg * dg + weightB * db * db);
}

/**
 * ピクセルデータ（Uint8ClampedArray または number[]）から平均 RGB 色を算出する。
 * アルファ値が 0 のピクセルは白背景（255, 255, 255）としてブレンドします。
 */
export function calculateAverageColorFromPixels(
    data: ArrayLike<number>,
    pixelCount: number,
): ColorRgb {
    if (pixelCount <= 0 || data.length === 0) {
        return { r: 128, g: 128, b: 128 };
    }

    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let validPixels = 0;

    for (let i = 0; i < pixelCount; i++) {
        const offset = i * 4;
        if (offset + 3 >= data.length) break;

        const a = data[offset + 3] / 255;
        if (a <= 0.01) {
            // 完全透明ピクセルは白としてカウント
            sumR += 255;
            sumG += 255;
            sumB += 255;
        } else {
            // アルファ値に応じた白背景ブレンド
            sumR += data[offset] * a + 255 * (1 - a);
            sumG += data[offset + 1] * a + 255 * (1 - a);
            sumB += data[offset + 2] * a + 255 * (1 - a);
        }
        validPixels++;
    }

    if (validPixels === 0) return { r: 128, g: 128, b: 128 };

    return {
        r: Math.round(sumR / validPixels),
        g: Math.round(sumG / validPixels),
        b: Math.round(sumB / validPixels),
    };
}

/**
 * 特定のセル目標色に対して、タイル一覧から最もスコアが良いタイルのインデックスを特定する。
 * 色味の変更・カラーオーバーレイを行わないため、純粋な色の近さと重複ペナルティから決定します。
 */
export function findBestTileIndex(
    targetColor: ColorRgb,
    tiles: Array<{ avgColor: ColorRgb }>,
    options?: {
        avoidIndices?: number[];
        usageCounts?: number[];
        penaltyWeight?: number;
    },
): number {
    if (tiles.length === 0) return -1;
    if (tiles.length === 1) return 0;

    const avoidSet = options?.avoidIndices ? new Set(options.avoidIndices) : null;
    const usageCounts = options?.usageCounts;
    const penaltyWeight = options?.penaltyWeight ?? 0;

    let bestIndex = 0;
    let minScore = Number.POSITIVE_INFINITY;

    for (let i = 0; i < tiles.length; i++) {
        const tileColor = tiles[i].avgColor;
        const colorDist = getColorDistance(
            targetColor.r,
            targetColor.g,
            targetColor.b,
            tileColor.r,
            tileColor.g,
            tileColor.b,
        );

        // 重複ペナルティ計算
        let penalty = 0;
        if (penaltyWeight > 0 && usageCounts) {
            const count = usageCounts[i] || 0;
            // 使用回数に応じたペナルティ（最大250程度まで加算）
            penalty += Math.min(250, count * penaltyWeight * 12);
        }

        // 直前・直上の隣接重複に対するペナルティ
        if (avoidSet && avoidSet.has(i)) {
            penalty += 120;
        }

        const score = colorDist + penalty;

        if (score < minScore) {
            minScore = score;
            bestIndex = i;
        }
    }

    return bestIndex;
}

/**
 * グリッド全体のタイル割り当て（モザイク設計図）を計算する。
 * 各セルに最も適したタイルのインデックス配列を返します。
 */
export function generateMosaicGridIndices(
    targetCells: ColorRgb[],
    columns: number,
    rows: number,
    tiles: Array<{ avgColor: ColorRgb }>,
    options: MosaicMatchOptions = {},
): number[] {
    const totalCells = columns * rows;
    if (tiles.length === 0 || totalCells === 0) return [];

    const result = new Array<number>(totalCells);
    const usageCounts = new Array<number>(tiles.length).fill(0);
    const penaltyWeight = options.duplicatePenaltyWeight ?? 1;
    const avoidAdjacent = options.avoidAdjacent ?? true;
    const noReuse = options.noReuse ?? false;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
            const index = row * columns + col;
            const targetColor = targetCells[index] || { r: 128, g: 128, b: 128 };

            if (noReuse) {
                // 再利用なしモード: 現在の最小使用回数（未到達なら0）のタイル群からのみ最適色を選出
                let minUsage = Number.POSITIVE_INFINITY;
                for (let i = 0; i < usageCounts.length; i++) {
                    if (usageCounts[i] < minUsage) {
                        minUsage = usageCounts[i];
                    }
                }

                let bestIdx = 0;
                let minDist = Number.POSITIVE_INFINITY;
                for (let i = 0; i < tiles.length; i++) {
                    if (usageCounts[i] !== minUsage) continue;
                    const tc = tiles[i].avgColor;
                    const dist = getColorDistance(
                        targetColor.r,
                        targetColor.g,
                        targetColor.b,
                        tc.r,
                        tc.g,
                        tc.b,
                    );
                    if (dist < minDist) {
                        minDist = dist;
                        bestIdx = i;
                    }
                }
                result[index] = bestIdx;
                usageCounts[bestIdx]++;
                continue;
            }

            const avoidIndices: number[] = [];
            if (avoidAdjacent) {
                // 左隣のタイル
                if (col > 0) {
                    avoidIndices.push(result[index - 1]);
                }
                // 上隣のタイル
                if (row > 0) {
                    avoidIndices.push(result[index - columns]);
                }
            }

            const chosenTileIndex = findBestTileIndex(targetColor, tiles, {
                avoidIndices: avoidIndices.length > 0 ? avoidIndices : undefined,
                usageCounts,
                penaltyWeight,
            });

            result[index] = chosenTileIndex;
            if (chosenTileIndex >= 0 && chosenTileIndex < usageCounts.length) {
                usageCounts[chosenTileIndex]++;
            }
        }
    }

    return result;
}

/**
 * 画像を指定されたセル領域に cover（中央配置・アスペクト比維持で枠一杯に切り抜き）で描画するための座標を計算する。
 */
export function calculateCoverCrop(
    srcWidth: number,
    srcHeight: number,
    destWidth: number,
    destHeight: number,
): { sx: number; sy: number; sw: number; sh: number } {
    if (srcWidth <= 0 || srcHeight <= 0 || destWidth <= 0 || destHeight <= 0) {
        return { sx: 0, sy: 0, sw: srcWidth, sh: srcHeight };
    }

    const srcAspect = srcWidth / srcHeight;
    const destAspect = destWidth / destHeight;

    let sw = srcWidth;
    let sh = srcHeight;
    let sx = 0;
    let sy = 0;

    if (srcAspect > destAspect) {
        // 元画像の方が横長：左右をトリミング
        sw = srcHeight * destAspect;
        sx = (srcWidth - sw) / 2;
    } else {
        // 元画像の方が縦長：上下をトリミング
        sh = srcWidth / destAspect;
        sy = (srcHeight - sh) / 2;
    }

    return { sx, sy, sw, sh };
}

/**
 * 有限数値へ安全にクランプする
 */
export function clampFinite(
    value: number,
    min: number,
    max: number,
    fallback: number,
): number {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
}

/**
 * ターゲット画像の解像度と選択したタイル形状から、最適なグリッド列数・行数を算出する
 */
export function calculateGridDimensions(
    imgWidth: number,
    imgHeight: number,
    columns: number,
    tileAspect: TileAspectRatio = "square",
): { cols: number; rows: number; tileAspectFactor: number } {
    const safeW = Math.max(1, clampFinite(imgWidth, 1, 16384, 1));
    const safeH = Math.max(1, clampFinite(imgHeight, 1, 16384, 1));
    const cols = Math.round(clampFinite(columns, 5, 240, 40));

    // tileAspectFactor = cellHeight / cellWidth
    const tileAspectFactor =
        tileAspect === "landscape" ? 3 / 4 : tileAspect === "portrait" ? 4 / 3 : 1;

    const imageAspect = safeH / safeW;
    const rows = Math.max(1, Math.round((cols * imageAspect) / tileAspectFactor));

    return { cols, rows, tileAspectFactor };
}

/**
 * 安全な Blob ObjectURL のみを生成する
 */
export function createSafeObjectUrl(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    if (!url.startsWith("blob:")) {
        throw new Error("Unsafe object URL scheme");
    }
    return url;
}
