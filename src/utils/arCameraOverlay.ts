export type OverlayMode = "ar" | "fixed";
export type CameraFacing = "environment" | "user";

export interface AlphaBounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
    /** 画像幅に対する不透明領域の水平中心比率 (0..1) */
    footCenterXRatio: number;
    /** 画像高さに対する不透明領域の最下端比率 (0..1) */
    footBottomYRatio: number;
    hasOpaquePixels: boolean;
}

export interface EnvironmentLighting {
    /** 平均相対輝度 (0..1) */
    luminance: number;
    /** 環境光の平均色 */
    ambientColor: { r: number; g: number; b: number };
    /** 画面の明暗勾配から推定した光源方位角 (0..360度) */
    suggestedAzimuthDeg: number;
    /** 環境のコントラストに応じた推奨影濃さ (0.15..0.75) */
    suggestedShadowOpacity: number;
    /** キャラクター馴染ませ用の明るさ補正係数 (0.55..1.25) */
    brightnessMultiplier: number;
}

export interface ProjectedShadowParams {
    /** 光源の方位角 (0=奥, 90=右, 180=手前, 270=左) */
    azimuthDeg: number;
    /** 光源の高度角 (5..85度) */
    elevationDeg: number;
    /** カメラの地面見下ろし角度 / パース角 (10..85度) */
    groundTiltDeg: number;
    /** 基本の影の濃さ (0..1) */
    shadowOpacity: number;
    /** 影のソフトネス / 半影 (0..1) */
    shadowSoftness: number;
    /** 描画上のキャラクター高さ (px) */
    characterHeightPx: number;
    /** 描画上のキャラクター幅 (px) */
    characterWidthPx: number;
}

export interface ProjectedShadowResult {
    /** 投影シルエットの水平シアー比 (tan相当) */
    skewXRatio: number;
    /** 投影シルエットの垂直圧縮比 (負値で奥向き、正値で手前向き) */
    scaleYRatio: number;
    /** 影の横オフセット (px) */
    offsetX: number;
    /** 影の縦オフセット (px) */
    offsetY: number;
    /** 影に適用するぼかし半径 (px) */
    blurPx: number;
    /** 最終的な投影影の不透明度 (0..1) */
    opacity: number;
    /** 接地コンタクトシャドウの横幅 (px) */
    contactWidthPx: number;
    /** 接地コンタクトシャドウの縦幅 (px) */
    contactHeightPx: number;
    /** 接地コンタクトシャドウの不透明度 (0..1) */
    contactOpacity: number;
}

export interface GyroOrientation {
    alpha: number;
    beta: number;
    gamma: number;
}

/**
 * 有限数値へ安全に正規化・クランプする
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
 * 角度を 0..360 の範囲に正規化する
 */
export function normalizeAngleDeg(deg: number): number {
    if (!Number.isFinite(deg)) return 0;
    const mod = deg % 360;
    return mod < 0 ? mod + 360 : mod;
}

/**
 * 2つの角度の最短差分 (-180..180) を計算する
 */
export function shortestAngleDeltaDeg(current: number, base: number): number {
    if (!Number.isFinite(current) || !Number.isFinite(base)) return 0;
    let delta = ((current - base + 180) % 360 + 360) % 360 - 180;
    if (delta === -180 && current - base > 0) delta = 180;
    return delta;
}

/**
 * 透過画像の RGBA ピクセル配列から不透明ピクセルのバウンディングボックスと足元基準点を解析する
 */
export function analyzeImageAlphaBounds(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    alphaThreshold = 12,
): AlphaBounds {
    const safeWidth = Math.max(1, Math.floor(clampFinite(width, 1, 16384, 1)));
    const safeHeight = Math.max(1, Math.floor(clampFinite(height, 1, 16384, 1)));
    const threshold = clampFinite(alphaThreshold, 0, 255, 12);

    let minX = safeWidth;
    let minY = safeHeight;
    let maxX = -1;
    let maxY = -1;

    const totalPixels = Math.min(safeWidth * safeHeight, Math.floor(data.length / 4));
    for (let idx = 0; idx < totalPixels; idx++) {
        const alpha = data[idx * 4 + 3];
        if (alpha > threshold) {
            const x = idx % safeWidth;
            const y = Math.floor(idx / safeWidth);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }

    if (maxX < minX || maxY < minY) {
        return {
            minX: 0,
            minY: 0,
            maxX: safeWidth - 1,
            maxY: safeHeight - 1,
            width: safeWidth,
            height: safeHeight,
            footCenterXRatio: 0.5,
            footBottomYRatio: 1,
            hasOpaquePixels: false,
        };
    }

    const boxHeight = maxY - minY + 1;
    const footBandStartY = Math.max(minY, maxY - Math.max(1, Math.floor(boxHeight * 0.12)));
    let footSumX = 0;
    let footCount = 0;
    for (let y = footBandStartY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const alpha = data[(y * safeWidth + x) * 4 + 3];
            if (alpha > threshold) {
                footSumX += x;
                footCount++;
            }
        }
    }

    const footCenterX = footCount > 0 ? footSumX / footCount : (minX + maxX) / 2;

    return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX + 1,
        height: boxHeight,
        footCenterXRatio: clampFinite((footCenterX + 0.5) / safeWidth, 0, 1, 0.5),
        footBottomYRatio: clampFinite((maxY + 1) / safeHeight, 0, 1, 1),
        hasOpaquePixels: true,
    };
}

/**
 * カメラ映像（または背景画像）の縮小フレームから環境光・平均色・推定光源方向を算出する
 */
export function estimateEnvironmentLighting(
    data: Uint8ClampedArray,
    width: number,
    height: number,
): EnvironmentLighting {
    const safeWidth = Math.max(1, Math.floor(clampFinite(width, 1, 4096, 1)));
    const safeHeight = Math.max(1, Math.floor(clampFinite(height, 1, 4096, 1)));
    const totalPixels = Math.min(safeWidth * safeHeight, Math.floor(data.length / 4));

    if (totalPixels === 0) {
        return {
            luminance: 0.5,
            ambientColor: { r: 128, g: 128, b: 128 },
            suggestedAzimuthDeg: 315,
            suggestedShadowOpacity: 0.45,
            brightnessMultiplier: 1,
        };
    }

    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let sumLum = 0;

    let leftLum = 0;
    let rightLum = 0;
    let topLum = 0;
    let bottomLum = 0;
    let leftCount = 0;
    let rightCount = 0;
    let topCount = 0;
    let bottomCount = 0;

    const midX = safeWidth / 2;
    const midY = safeHeight / 2;

    for (let idx = 0; idx < totalPixels; idx++) {
        const base = idx * 4;
        const r = data[base];
        const g = data[base + 1];
        const b = data[base + 2];
        const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

        sumR += r;
        sumG += g;
        sumB += b;
        sumLum += lum;

        const x = idx % safeWidth;
        const y = Math.floor(idx / safeWidth);

        if (x < midX) {
            leftLum += lum;
            leftCount++;
        } else {
            rightLum += lum;
            rightCount++;
        }

        if (y < midY) {
            topLum += lum;
            topCount++;
        } else {
            bottomLum += lum;
            bottomCount++;
        }
    }

    const avgLum = clampFinite(sumLum / totalPixels, 0, 1, 0.5);
    const avgR = Math.round(clampFinite(sumR / totalPixels, 0, 255, 128));
    const avgG = Math.round(clampFinite(sumG / totalPixels, 0, 255, 128));
    const avgB = Math.round(clampFinite(sumB / totalPixels, 0, 255, 128));

    const avgLeft = leftCount > 0 ? leftLum / leftCount : avgLum;
    const avgRight = rightCount > 0 ? rightLum / rightCount : avgLum;
    const avgTop = topCount > 0 ? topLum / topCount : avgLum;
    const avgBottom = bottomCount > 0 ? bottomLum / bottomCount : avgLum;

    const dx = avgRight - avgLeft;
    const dy = avgTop - avgBottom;

    let suggestedAzimuthDeg = 315;
    if (Math.hypot(dx, dy) > 0.025) {
        const rad = Math.atan2(dx, dy);
        suggestedAzimuthDeg = Math.round(normalizeAngleDeg((rad * 180) / Math.PI));
    }

    const suggestedShadowOpacity = clampFinite(
        0.22 + avgLum * 0.45,
        0.18,
        0.68,
        0.45,
    );

    const brightnessMultiplier = clampFinite(
        0.65 + avgLum * 0.55,
        0.6,
        1.18,
        1,
    );

    return {
        luminance: avgLum,
        ambientColor: { r: avgR, g: avgG, b: avgB },
        suggestedAzimuthDeg,
        suggestedShadowOpacity,
        brightnessMultiplier,
    };
}

/**
 * 物理的な平行光源モデルとカメラの地面パース角度から、地面上の投影影・接地影パラメータを計算する
 */
export function calculateProjectedShadowTransform(
    params: ProjectedShadowParams,
): ProjectedShadowResult {
    const azRad = (normalizeAngleDeg(params.azimuthDeg) * Math.PI) / 180;
    const elevDeg = clampFinite(params.elevationDeg, 8, 85, 42);
    const elevRad = (elevDeg * Math.PI) / 180;
    const tiltDeg = clampFinite(params.groundTiltDeg, 10, 85, 32);
    const tiltRad = (tiltDeg * Math.PI) / 180;

    const baseOpacity = clampFinite(params.shadowOpacity, 0, 1, 0.5);
    const softness = clampFinite(params.shadowSoftness, 0, 1, 0.4);
    const charH = clampFinite(params.characterHeightPx, 10, 8000, 300);
    const charW = clampFinite(params.characterWidthPx, 10, 8000, 180);

    const cotElev = 1 / Math.tan(elevRad);
    const clampedLengthFactor = clampFinite(cotElev, 0.08, 3.2, 1.0);

    const dirX = -Math.sin(azRad);
    const dirY = Math.cos(azRad);
    const perspectiveY = Math.sin(tiltRad);

    const rawScaleY = dirY * clampedLengthFactor * perspectiveY;
    const minAbsScaleY = 0.14 * perspectiveY;
    const scaleYRatio =
        Math.abs(rawScaleY) < minAbsScaleY
            ? (rawScaleY >= 0 ? 1 : -1) * minAbsScaleY
            : clampFinite(rawScaleY, -1.8, 1.8, -0.35);

    const skewXRatio = clampFinite(-dirX * clampedLengthFactor, -2.5, 2.5, 0.3);

    const blurPx = clampFinite(
        softness * (3 + clampedLengthFactor * 10) * (charH / 320),
        0,
        42,
        4,
    );

    const opacity = clampFinite(
        baseOpacity * (0.95 - clampedLengthFactor * 0.12),
        0.05,
        0.92,
        0.42,
    );

    const contactWidthPx = clampFinite(charW * 0.62, 12, 4000, 100);
    const contactHeightPx = clampFinite(
        contactWidthPx * clampFinite(perspectiveY * 0.36, 0.12, 0.45, 0.2),
        4,
        600,
        20,
    );
    const contactOpacity = clampFinite(baseOpacity * 1.15, 0.08, 0.88, 0.55);

    return {
        skewXRatio,
        scaleYRatio,
        offsetX: dirX * 2,
        offsetY: dirY * 2,
        blurPx,
        opacity,
        contactWidthPx,
        contactHeightPx,
        contactOpacity,
    };
}

/**
 * ジャイロセンサー（DeviceOrientation）の差分角から、AR空間アンカー用の視差オフセットを計算する
 */
export function calculateGyroParallaxOffset(
    current: GyroOrientation,
    base: GyroOrientation,
    canvasWidth: number,
    canvasHeight: number,
    sensitivity = 1.0,
): { offsetX: number; offsetY: number; tiltSkewDeg: number } {
    const safeW = clampFinite(canvasWidth, 100, 8000, 1280);
    const safeH = clampFinite(canvasHeight, 100, 8000, 720);
    const sens = clampFinite(sensitivity, 0.1, 3.0, 1.0);

    const dAlpha = shortestAngleDeltaDeg(current.alpha, base.alpha);
    const dBeta = clampFinite(current.beta - base.beta, -75, 75, 0);
    const dGamma = clampFinite(current.gamma - base.gamma, -75, 75, 0);

    const pxPerDegX = (safeW / 60) * sens;
    const pxPerDegY = (safeH / 45) * sens;

    const offsetX = clampFinite(dAlpha * pxPerDegX, -safeW * 1.5, safeW * 1.5, 0);
    const offsetY = clampFinite(dBeta * pxPerDegY, -safeH * 1.5, safeH * 1.5, 0);
    const tiltSkewDeg = clampFinite(-dGamma * 0.25 * sens, -15, 15, 0);

    return {
        offsetX,
        offsetY,
        tiltSkewDeg,
    };
}

/**
 * 透過画像のアルファチャンネルを保持したまま、指定した影色のシルエットピクセル配列を生成する
 */
export function createShadowSilhouettePixels(
    sourceData: Uint8ClampedArray,
    shadowRgb: { r: number; g: number; b: number } = { r: 12, g: 16, b: 28 },
): Uint8ClampedArray {
    const out = new Uint8ClampedArray(sourceData.length);
    const r = Math.round(clampFinite(shadowRgb.r, 0, 255, 12));
    const g = Math.round(clampFinite(shadowRgb.g, 0, 255, 16));
    const b = Math.round(clampFinite(shadowRgb.b, 0, 255, 28));

    for (let i = 0; i + 3 < sourceData.length; i += 4) {
        const a = sourceData[i + 3];
        if (a > 0) {
            out[i] = r;
            out[i + 1] = g;
            out[i + 2] = b;
            out[i + 3] = a;
        }
    }
    return out;
}

/**
 * 安全な Blob ObjectURL のみを生成する（CodeQL / XSS 対策）
 */
export function createSafeObjectUrl(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    if (!url.startsWith("blob:")) {
        throw new Error("Unsafe object URL scheme");
    }
    return url;
}

const IMAGE_FILE_EXTENSIONS = new Set([
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif",
    "bmp",
    "svg",
    "avif",
]);

/**
 * クラウドドライブ等から選択されたファイル（MIMEタイプが空やoctet-streamになる場合を含む）が
 * 画像ファイルとして扱えるか判定する
 */
export function isSupportedImageFile(fileName: string, mimeType: string): boolean {
    if (mimeType && mimeType.toLowerCase().startsWith("image/")) {
        return true;
    }
    const lastDot = fileName.lastIndexOf(".");
    if (lastDot === -1) return false;
    const ext = fileName.slice(lastDot + 1).toLowerCase();
    return IMAGE_FILE_EXTENSIONS.has(ext);
}
