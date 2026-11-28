import {
    clampFinite,
    estimateEnvironmentLighting,
    type EnvironmentLighting,
} from "./arCameraOverlay";

export interface CharacterHitBounds {
    id: string;
    posXPercent: number;
    posYPercent: number;
    scale: number;
    cameraDistanceM: number;
    aspectRatio: number;
    footCenterXRatio: number;
    footBottomYRatio: number;
}

/**
 * 複数キャラクターを奥行き順（カメラ距離が遠い＝大きい順、同距離なら画面上側の奥＝posYPercentが小さい順）に並べる
 */
export function sortCharacterLayersByDepth<T extends { cameraDistanceM: number; posYPercent: number }>(
    layers: readonly T[],
): T[] {
    return [...layers].sort((a, b) => {
        const distDiff = b.cameraDistanceM - a.cameraDistanceM;
        if (Math.abs(distDiff) > 0.05) return distDiff;
        return a.posYPercent - b.posYPercent;
    });
}

/**
 * キャンバス上の正規化座標 (nx, ny: 0..1) から、手前側優先でヒットするキャラクターIDを返す
 */
export function hitTestCharacterLayer(
    orderedLayersBackToFront: readonly CharacterHitBounds[],
    nx: number,
    ny: number,
): string | null {
    const safeX = clampFinite(nx, -1, 2, 0.5);
    const safeY = clampFinite(ny, -1, 2, 0.5);

    // 手前（配列末尾）から順にヒット判定
    for (let i = orderedLayersBackToFront.length - 1; i >= 0; i--) {
        const item = orderedLayersBackToFront[i];
        const drawHRatio = 0.62 * clampFinite(item.scale, 0.1, 4.0, 0.65);
        const drawWRatio = drawHRatio * clampFinite(item.aspectRatio, 0.1, 5.0, 0.5);
        const footX = item.posXPercent / 100;
        const footY = item.posYPercent / 100;

        const left = footX - drawWRatio * item.footCenterXRatio;
        const right = left + drawWRatio;
        const top = footY - drawHRatio * item.footBottomYRatio;
        const bottom = top + drawHRatio;

        // 操作しやすいようわずかに余白を持たせて判定
        const padX = Math.max(0.025, drawWRatio * 0.08);
        const padY = Math.max(0.025, drawHRatio * 0.04);
        if (
            safeX >= left - padX &&
            safeX <= right + padX &&
            safeY >= top - padY &&
            safeY <= bottom + padY
        ) {
            return item.id;
        }
    }
    return null;
}

/**
 * 背景画像の全体環境光と、キャラクター立ち位置周辺の局所環境光をブレンドして推定する
 * （日向と日陰でキャラごとの色味・明るさを自然に変化させるため）
 */
export function estimateLocalEnvironmentLighting(
    rgba: Uint8ClampedArray,
    width: number,
    height: number,
    nx: number,
    ny: number,
): EnvironmentLighting {
    const globalLighting = estimateEnvironmentLighting(rgba, width, height);
    const safeW = Math.max(1, Math.floor(clampFinite(width, 1, 2048, 1)));
    const safeH = Math.max(1, Math.floor(clampFinite(height, 1, 2048, 1)));
    if (rgba.length < safeW * safeH * 4) return globalLighting;

    const cx = clampFinite(nx, 0.05, 0.95, 0.5) * (safeW - 1);
    const cy = clampFinite(ny, 0.05, 0.95, 0.78) * (safeH - 1);
    const rx = Math.max(2, safeW * 0.16);
    const ry = Math.max(2, safeH * 0.22);

    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let sumLum = 0;
    let count = 0;

    const y0 = Math.max(0, Math.floor(cy - ry));
    const y1 = Math.min(safeH - 1, Math.ceil(cy + ry * 0.4));
    const x0 = Math.max(0, Math.floor(cx - rx));
    const x1 = Math.min(safeW - 1, Math.ceil(cx + rx));

    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const p = (y * safeW + x) * 4;
            const r = rgba[p];
            const g = rgba[p + 1];
            const b = rgba[p + 2];
            sumR += r;
            sumG += g;
            sumB += b;
            sumLum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
            count++;
        }
    }

    if (count === 0) return globalLighting;
    const localR = sumR / count;
    const localG = sumG / count;
    const localB = sumB / count;
    const localLum = sumLum / count;

    // 局所60% + 全体40% で自然にブレンド
    const lum = clampFinite(localLum * 0.6 + globalLighting.luminance * 0.4, 0, 1, 0.55);
    return {
        luminance: lum,
        ambientColor: {
            r: Math.round(localR * 0.6 + globalLighting.ambientColor.r * 0.4),
            g: Math.round(localG * 0.6 + globalLighting.ambientColor.g * 0.4),
            b: Math.round(localB * 0.6 + globalLighting.ambientColor.b * 0.4),
        },
        suggestedAzimuthDeg: globalLighting.suggestedAzimuthDeg,
        suggestedShadowOpacity: clampFinite(0.2 + lum * 0.42, 0.15, 0.75, 0.45),
        brightnessMultiplier: clampFinite(0.62 + lum * 0.52, 0.55, 1.2, 1.0),
    };
}

export interface DepthSegmentedLayer {
    /** 0 = 最前面（手前）、大きいほど奥 */
    index: number;
    label: string;
    minDepth: number;
    maxDepth: number;
    meanDepth: number;
    pixelRatio: number;
    estimatedDistanceM: number;
    maskRgba: Uint8ClampedArray;
}

const DEFAULT_LAYER_LABELS_4 = [
    "最前面オブジェクト",
    "近景オブジェクト",
    "中景オブジェクト",
    "遠景・背景",
] as const;

function buildLayerLabel(index: number, count: number): string {
    if (count === 4 && index >= 0 && index < DEFAULT_LAYER_LABELS_4.length) {
        return DEFAULT_LAYER_LABELS_4[index];
    }
    if (index === 0) return "最前面オブジェクト";
    if (index === count - 1) return "遠景・背景";
    return `中間オブジェクト ${index}`;
}

/**
 * AI深度マップから写真を「手前→奥」の複数オブジェクトレイヤーに分割し、
 * 各レイヤーのアルファマスク RGBA を生成する。
 */
export function segmentDepthIntoObjectLayers(
    normalizedDepth: Float32Array,
    width: number,
    height: number,
    layerCount = 4,
): DepthSegmentedLayer[] {
    const safeW = Math.max(1, Math.floor(clampFinite(width, 1, 2048, 1)));
    const safeH = Math.max(1, Math.floor(clampFinite(height, 1, 2048, 1)));
    const total = safeW * safeH;
    const count = Math.max(2, Math.min(6, Math.round(clampFinite(layerCount, 2, 6, 4))));
    if (normalizedDepth.length < total) return [];

    // 高速な分位点計算のため最大 16,384 サンプルを均等抽出
    const step = Math.max(1, Math.floor(total / 16384));
    const samples: number[] = [];
    for (let i = 0; i < total; i += step) {
        const d = normalizedDepth[i];
        samples.push(Number.isFinite(d) ? Math.max(0, Math.min(1, d)) : 0.5);
    }
    samples.sort((a, b) => b - a); // 降順（手前 1.0 -> 奥 0.0）

    const boundaries: number[] = [1.0];
    for (let k = 1; k < count; k++) {
        const idx = Math.min(samples.length - 1, Math.max(0, Math.floor((k / count) * samples.length)));
        const prev = boundaries[k - 1];
        const candidate = samples[idx];
        // 単調非増加を保証し、極端に狭い帯域を避ける
        boundaries.push(Math.min(prev - 0.02, Math.max(0.02 * (count - k), candidate)));
    }
    boundaries.push(0.0);

    const feather = 0.025;
    const layers: DepthSegmentedLayer[] = [];

    for (let i = 0; i < count; i++) {
        const maxDepth = boundaries[i];
        const minDepth = boundaries[i + 1];
        const maskRgba = new Uint8ClampedArray(total * 4);
        let depthSum = 0;
        let activePixels = 0;

        for (let p = 0; p < total; p++) {
            const raw = normalizedDepth[p];
            const d = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0.5;
            let alpha = 0;
            if (i === count - 1) {
                // 最奥レイヤーは全背景の土台として完全に不透明
                alpha = 255;
                if (d <= maxDepth) {
                    depthSum += d;
                    activePixels++;
                }
            } else if (d >= minDepth - feather) {
                // minDepth 境界のみフェザリングし、手前側の境界は重なりを許容して隙間を防ぐ
                const t = d >= minDepth ? 1 : (d - (minDepth - feather)) / feather;
                alpha = Math.round(Math.max(0, Math.min(1, t)) * 255);
                if (d >= minDepth && d <= maxDepth) {
                    depthSum += d;
                    activePixels++;
                }
            }
            const o = p * 4;
            maskRgba[o] = 255;
            maskRgba[o + 1] = 255;
            maskRgba[o + 2] = 255;
            maskRgba[o + 3] = alpha;
        }

        const meanDepth =
            activePixels > 0
                ? depthSum / activePixels
                : (minDepth + maxDepth) * 0.5;
        const pixelRatio = activePixels / Math.max(1, total);
        const estimatedDistanceM =
            Math.round(clampFinite(0.6 + (1 - meanDepth) * 14, 0.5, 25, 3) * 10) / 10;

        layers.push({
            index: i,
            label: buildLayerLabel(i, count),
            minDepth: Math.round(minDepth * 1000) / 1000,
            maxDepth: Math.round(maxDepth * 1000) / 1000,
            meanDepth: Math.round(meanDepth * 1000) / 1000,
            pixelRatio: Math.round(pixelRatio * 1000) / 1000,
            estimatedDistanceM,
            maskRgba,
        });
    }

    return layers;
}

/**
 * 立ち絵の足元深度（0=最奥, 1=最手前）から、
 * どの背景レイヤーの隙間 (0=最前面 .. layers.length=最背面) に挟み込むべきかを推奨する。
 */
export function recommendInsertSlotForDepth(
    layers: readonly DepthSegmentedLayer[],
    characterDepth: number,
): number {
    if (layers.length === 0) return 0;
    const safeDepth = clampFinite(characterDepth, 0, 1, 0.5);
    let slot = 0;
    for (let i = 0; i < layers.length; i++) {
        if (layers[i].meanDepth > safeDepth + 0.04) {
            slot = i + 1;
        } else {
            break;
        }
    }
    return Math.max(0, Math.min(layers.length, slot));
}
