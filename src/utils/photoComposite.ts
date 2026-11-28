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
