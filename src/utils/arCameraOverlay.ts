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

function deviceOrientationForwardVector(o: GyroOrientation): [number, number, number] {
    const deg2rad = Math.PI / 180;
    const a = normalizeAngleDeg(o.alpha) * deg2rad;
    const b = clampFinite(o.beta, -180, 180, 0) * deg2rad;
    const g = clampFinite(o.gamma, -90, 90, 0) * deg2rad;

    const cA = Math.cos(a);
    const sA = Math.sin(a);
    const cB = Math.cos(b);
    const sB = Math.sin(b);
    const cG = Math.cos(g);
    const sG = Math.sin(g);

    // W3C DeviceOrientation Z-X'-Y'' 回転行列の第3列の符号反転 (-R * [0, 0, 1]) = 背面カメラのワールド視線方向
    const vx = -(cA * sG + sA * sB * cG);
    const vy = -(sA * sG - cA * sB * cG);
    const vz = -(cB * cG);
    return [vx, vy, vz];
}

function deviceOrientationBasis(o: GyroOrientation): {
    right: [number, number, number];
    up: [number, number, number];
    forward: [number, number, number];
} {
    const deg2rad = Math.PI / 180;
    const a = normalizeAngleDeg(o.alpha) * deg2rad;
    const b = clampFinite(o.beta, -180, 180, 0) * deg2rad;
    const g = clampFinite(o.gamma, -90, 90, 0) * deg2rad;

    const cA = Math.cos(a);
    const sA = Math.sin(a);
    const cB = Math.cos(b);
    const sB = Math.sin(b);
    const cG = Math.cos(g);
    const sG = Math.sin(g);

    // R = Rz(a) * Rx(b) * Ry(g) の各列ベクトル
    const right: [number, number, number] = [
        cA * cG - sA * sB * sG,
        sA * cG + cA * sB * sG,
        -cB * sG,
    ];
    const up: [number, number, number] = [
        -sA * cB,
        cA * cB,
        sB,
    ];
    const forward = deviceOrientationForwardVector(o);
    return { right, up, forward };
}

/**
 * ジャイロセンサー（DeviceOrientation）の3D回転行列差分（ジンバルロック耐性）から、
 * AR空間アンカー用の視差オフセットを計算する
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

    const baseBasis = deviceOrientationBasis(base);
    const curFwd = deviceOrientationForwardVector(current);

    // 基準カメラ座標系に投影した現在の視線ベクトル
    const relX =
        curFwd[0] * baseBasis.right[0] +
        curFwd[1] * baseBasis.right[1] +
        curFwd[2] * baseBasis.right[2];
    const relY =
        curFwd[0] * baseBasis.up[0] +
        curFwd[1] * baseBasis.up[1] +
        curFwd[2] * baseBasis.up[2];
    const relZ =
        curFwd[0] * baseBasis.forward[0] +
        curFwd[1] * baseBasis.forward[1] +
        curFwd[2] * baseBasis.forward[2];

    const yawDeg = (Math.atan2(relX, Math.max(0.15, relZ)) * 180) / Math.PI;
    const pitchDeg = (Math.atan2(relY, Math.max(0.15, relZ)) * 180) / Math.PI;

    const pxPerDegX = (safeW / 60) * sens;
    const pxPerDegY = (safeH / 45) * sens;

    // カメラが右を向くと(yawDeg > 0)、空間上のアンカーは左(-)へ移動する
    const offsetX = clampFinite(-yawDeg * pxPerDegX, -safeW * 1.5, safeW * 1.5, 0);
    const offsetY = clampFinite(pitchDeg * pxPerDegY, -safeH * 1.5, safeH * 1.5, 0);

    const dGamma = shortestAngleDeltaDeg(current.gamma, base.gamma);
    const tiltSkewDeg = clampFinite(-dGamma * 0.18 * sens, -15, 15, 0);

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

/**
 * 生の深度配列を 0..1（0=最も奥、1=最も手前）へ min-max 正規化する
 */
export function normalizeDepthMap(
    rawValues: ArrayLike<number>,
    width: number,
    height: number,
): Float32Array {
    const safeW = Math.max(1, Math.floor(clampFinite(width, 1, 4096, 1)));
    const safeH = Math.max(1, Math.floor(clampFinite(height, 1, 4096, 1)));
    const total = Math.min(safeW * safeH, rawValues.length);
    const out = new Float32Array(safeW * safeH);
    if (total === 0) return out;

    let minVal = Infinity;
    let maxVal = -Infinity;
    for (let i = 0; i < total; i++) {
        const v = rawValues[i];
        if (!Number.isFinite(v)) continue;
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
    }

    if (!Number.isFinite(minVal) || !Number.isFinite(maxVal) || maxVal - minVal < 1e-6) {
        return out;
    }

    const span = maxVal - minVal;
    for (let i = 0; i < total; i++) {
        const v = rawValues[i];
        out[i] = Number.isFinite(v) ? clampFinite((v - minVal) / span, 0, 1, 0) : 0;
    }
    return out;
}

/**
 * 正規化深度マップ（0=奥 .. 1=手前）とキャラクターの前後しきい値から、
 * キャラクターより手前にある物体を隠すための遮蔽マスク RGBA ピクセル配列を生成する
 */
export function generateDepthOcclusionMaskPixels(
    normalizedDepth: ArrayLike<number>,
    width: number,
    height: number,
    threshold01: number,
    feather = 0.015,
): Uint8ClampedArray {
    const safeW = Math.max(1, Math.floor(clampFinite(width, 1, 4096, 1)));
    const safeH = Math.max(1, Math.floor(clampFinite(height, 1, 4096, 1)));
    const total = safeW * safeH;
    const out = new Uint8ClampedArray(total * 4);
    const threshold = clampFinite(threshold01, 0, 1, 0.55);
    const safeFeather = clampFinite(feather, 0.001, 0.25, 0.015);

    for (let i = 0; i < total && i < normalizedDepth.length; i++) {
        const d = clampFinite(normalizedDepth[i], 0, 1, 0);
        if (d <= threshold - safeFeather) continue;

        let alphaRatio = 1;
        if (d < threshold + safeFeather) {
            alphaRatio = (d - (threshold - safeFeather)) / (safeFeather * 2);
        }
        const alpha = Math.round(clampFinite(alphaRatio, 0, 1, 0) * 255);
        if (alpha > 0) {
            const p = i * 4;
            out[p] = 255;
            out[p + 1] = 0;
            out[p + 2] = 0;
            out[p + 3] = alpha;
        }
    }
    return out;
}

/**
 * 正規化深度マップの指定位置 (nx, ny: 0..1) 周辺 3x3 の平均深度を取得する
 */
export function sampleDepthAtNormalizedPoint(
    normalizedDepth: ArrayLike<number>,
    width: number,
    height: number,
    nx: number,
    ny: number,
): number {
    const safeW = Math.max(1, Math.floor(clampFinite(width, 1, 4096, 1)));
    const safeH = Math.max(1, Math.floor(clampFinite(height, 1, 4096, 1)));
    if (normalizedDepth.length < safeW * safeH) return 0.5;

    const fx = Math.round(clampFinite(nx, 0, 1, 0.5) * (safeW - 1));
    const fy = Math.round(clampFinite(ny, 0, 1, 0.78) * (safeH - 1));
    let sum = 0;
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const sx = Math.min(safeW - 1, Math.max(0, fx + dx));
            const sy = Math.min(safeH - 1, Math.max(0, fy + dy));
            const v = normalizedDepth[sy * safeW + sx];
            if (Number.isFinite(v)) {
                sum += v;
                count++;
            }
        }
    }
    return count > 0 ? clampFinite(sum / count, 0, 1, 0.5) : 0.5;
}

export interface CharacterHeightScaleParams {
    /** キャラクターの設定身長 (cm) */
    characterHeightCm: number;
    /** カメラからキャラクターまでの想定距離 (m) */
    distanceMeters: number;
    /** 画像高さに対する不透明キャラクター領域の高さ比率 (0.1..1.0) */
    opaqueHeightRatio?: number;
    /** カメラの垂直画角 (度, スマホ広角標準 ~60度) */
    verticalFovDeg?: number;
    /** scale=1.0 時のキャンバス高さ基準比率 (0.62) */
    baseCanvasHeightRatio?: number;
}

/**
 * キャラクターの設定身長(cm)とカメラからの距離(m)に基づき、
 * 透視投影（ピンホールカメラモデル）で実寸に近い表示拡大率(scale: 0.1..4.0)を算出する
 */
export function calculateScaleForCharacterHeight(params: CharacterHeightScaleParams): number {
    const heightM = clampFinite(params.characterHeightCm, 20, 350, 160) / 100;
    const distM = clampFinite(params.distanceMeters, 0.3, 30, 2.5);
    const opaqueRatio = clampFinite(params.opaqueHeightRatio ?? 1.0, 0.1, 1.0, 1.0);
    const fovRad = (clampFinite(params.verticalFovDeg ?? 72, 25, 110, 72) * Math.PI) / 180;
    const baseRatio = clampFinite(params.baseCanvasHeightRatio ?? 0.62, 0.1, 1.0, 0.62);

    const viewHeightM = 2 * distM * Math.tan(fovRad / 2);
    if (viewHeightM <= 0) return 0.65;

    const screenHeightRatio = heightM / viewHeightM;
    const rawScale = screenHeightRatio / (baseRatio * opaqueRatio);
    return Math.round(clampFinite(rawScale, 0.1, 4.0, 0.65) * 100) / 100;
}

/**
 * 正規化深度マップ（0=奥 .. 1=手前）の下半分（床領域）の奥行き勾配から
 * カメラの見下ろし角度（18..72度）を推定する
 */
export function estimateGroundTiltFromDepthMap(
    normalizedDepth: ArrayLike<number>,
    width: number,
    height: number,
): number {
    const safeW = Math.max(1, Math.floor(clampFinite(width, 1, 4096, 1)));
    const safeH = Math.max(1, Math.floor(clampFinite(height, 1, 4096, 1)));
    if (normalizedDepth.length < safeW * safeH) return 34;

    const midRowStart = Math.floor(safeH * 0.52);
    const midRowEnd = Math.floor(safeH * 0.66);
    const botRowStart = Math.floor(safeH * 0.80);
    const botRowEnd = Math.floor(safeH * 0.94);

    let midSum = 0;
    let midCount = 0;
    let botSum = 0;
    let botCount = 0;

    const colStart = Math.floor(safeW * 0.2);
    const colEnd = Math.ceil(safeW * 0.8);

    for (let y = midRowStart; y < midRowEnd; y++) {
        for (let x = colStart; x < colEnd; x++) {
            const v = normalizedDepth[y * safeW + x];
            if (Number.isFinite(v)) {
                midSum += v;
                midCount++;
            }
        }
    }
    for (let y = botRowStart; y < botRowEnd; y++) {
        for (let x = colStart; x < colEnd; x++) {
            const v = normalizedDepth[y * safeW + x];
            if (Number.isFinite(v)) {
                botSum += v;
                botCount++;
            }
        }
    }

    if (midCount === 0 || botCount === 0) return 34;
    const midAvg = midSum / midCount;
    const botAvg = botSum / botCount;
    const gradient = clampFinite(botAvg - midAvg, -0.5, 0.8, 0.2);

    // 勾配が急なほど見下ろし角が大きく、水平に近いほど小さい
    const estimated = 22 + clampFinite(gradient, 0, 0.6, 0.2) * 75;
    return Math.round(clampFinite(estimated, 18, 72, 34));
}

/**
 * 足元位置の深度を基準に「床や机などの接地同一面」にだけ影を残すマスク RGBA を生成する
 * （空や遠くの壁・段差の向こう側への影のはみ出しを抑制する）
 */
export function generateGroundShadowMaskPixels(
    normalizedDepth: ArrayLike<number>,
    width: number,
    height: number,
    footXRatio: number,
    footYRatio: number,
    depthTolerance = 0.22,
): Uint8ClampedArray {
    const safeW = Math.max(1, Math.floor(clampFinite(width, 1, 4096, 1)));
    const safeH = Math.max(1, Math.floor(clampFinite(height, 1, 4096, 1)));
    const total = safeW * safeH;
    const out = new Uint8ClampedArray(total * 4);
    if (normalizedDepth.length < total) return out;

    const fx = Math.round(clampFinite(footXRatio, 0.05, 0.95, 0.5) * (safeW - 1));
    const fy = Math.round(clampFinite(footYRatio, 0.05, 0.95, 0.78) * (safeH - 1));

    // 足元周辺 3x3 の中央平均深度を取得
    let refSum = 0;
    let refCount = 0;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const sx = Math.min(safeW - 1, Math.max(0, fx + dx));
            const sy = Math.min(safeH - 1, Math.max(0, fy + dy));
            const v = normalizedDepth[sy * safeW + sx];
            if (Number.isFinite(v)) {
                refSum += v;
                refCount++;
            }
        }
    }
    const footDepth = refCount > 0 ? refSum / refCount : 0.5;
    const tol = clampFinite(depthTolerance, 0.05, 0.6, 0.22);

    for (let i = 0; i < total; i++) {
        const d = clampFinite(normalizedDepth[i], 0, 1, footDepth);
        const diff = Math.abs(d - footDepth);
        let alphaRatio = 0;
        if (diff <= tol * 0.65) {
            alphaRatio = 1;
        } else if (diff < tol * 1.45) {
            alphaRatio = 1 - (diff - tol * 0.65) / (tol * 0.8);
        }
        const alpha = Math.round(clampFinite(alphaRatio, 0, 1, 0) * 255);
        const p = i * 4;
        out[p] = 255;
        out[p + 1] = 255;
        out[p + 2] = 255;
        out[p + 3] = alpha;
    }
    return out;
}

/**
 * 縮小グレースケールフレーム間の2Dブロックマッチングにより、
 * 背景の平行移動シフト (dx, dy in px) を高速に推定する（AR位置固定の補強用）
 */
export function estimateBackgroundOpticalShift(
    prevGray: Uint8Array | Uint8ClampedArray,
    currGray: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number,
    maxSearchPx = 6,
): { dx: number; dy: number; confidence: number } {
    const safeW = Math.max(8, Math.floor(clampFinite(width, 8, 512, 64)));
    const safeH = Math.max(8, Math.floor(clampFinite(height, 8, 512, 36)));
    const total = safeW * safeH;
    if (prevGray.length < total || currGray.length < total) {
        return { dx: 0, dy: 0, confidence: 0 };
    }

    const search = Math.max(1, Math.min(12, Math.floor(clampFinite(maxSearchPx, 1, 12, 6))));
    const margin = search + 2;
    if (safeW <= margin * 2 || safeH <= margin * 2) {
        return { dx: 0, dy: 0, confidence: 0 };
    }

    // 背景のテクスチャ（コントラスト）が十分にあるか確認
    let mean = 0;
    let count = 0;
    for (let y = margin; y < safeH - margin; y += 2) {
        for (let x = margin; x < safeW - margin; x += 2) {
            mean += prevGray[y * safeW + x];
            count++;
        }
    }
    mean /= Math.max(1, count);

    let variance = 0;
    for (let y = margin; y < safeH - margin; y += 2) {
        for (let x = margin; x < safeW - margin; x += 2) {
            const diff = prevGray[y * safeW + x] - mean;
            variance += diff * diff;
        }
    }
    variance /= Math.max(1, count);
    if (variance < 18) {
        // 無地で特徴がない背景は誤トラッキングを防ぐため 0 を返す
        return { dx: 0, dy: 0, confidence: 0 };
    }

    let bestDx = 0;
    let bestDy = 0;
    let bestSad = Infinity;
    let zeroSad = 0;

    for (let dy = -search; dy <= search; dy++) {
        for (let dx = -search; dx <= search; dx++) {
            let sad = 0;
            let samples = 0;
            for (let y = margin; y < safeH - margin; y += 2) {
                const cy = y + dy;
                for (let x = margin; x < safeW - margin; x += 2) {
                    const cx = x + dx;
                    sad += Math.abs(currGray[cy * safeW + cx] - prevGray[y * safeW + x]);
                    samples++;
                }
            }
            const avgSad = sad / Math.max(1, samples);
            if (dx === 0 && dy === 0) zeroSad = avgSad;
            if (avgSad < bestSad) {
                bestSad = avgSad;
                bestDx = dx;
                bestDy = dy;
            }
        }
    }

    const improvement = zeroSad > 0 ? clampFinite((zeroSad - bestSad) / zeroSad, 0, 1, 0) : 0;
    if (bestSad > 32 || (bestDx === 0 && bestDy === 0)) {
        return { dx: 0, dy: 0, confidence: improvement };
    }

    return {
        dx: bestDx,
        dy: bestDy,
        confidence: clampFinite(improvement * 2, 0.1, 1, 0.5),
    };
}
