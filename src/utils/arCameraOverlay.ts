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
    /** 解析元画像高さに対する不透明領域高さの比率 (0..1) */
    opaqueHeightRatio: number;
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

export interface GyroQuaternion {
    x: number;
    y: number;
    z: number;
    w: number;
}

export interface GyroOrientation {
    alpha: number;
    beta: number;
    gamma: number;
    /** 画面の回転角 (0, 90, 180, 270) */
    screenAngleDeg?: number;
    /** ジンバルロックフリーの単位クォータニオン（平滑化済み姿勢） */
    q?: GyroQuaternion;
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
            opaqueHeightRatio: 1,
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
        opaqueHeightRatio: clampFinite(boxHeight / safeHeight, 0.05, 1, 1),
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

function basisToQuaternion(basis: {
    right: [number, number, number];
    up: [number, number, number];
    forward: [number, number, number];
}): GyroQuaternion {
    // R の列は [right, up, back] (back = -forward)
    const r00 = basis.right[0];
    const r10 = basis.right[1];
    const r20 = basis.right[2];
    const r01 = basis.up[0];
    const r11 = basis.up[1];
    const r21 = basis.up[2];
    const r02 = -basis.forward[0];
    const r12 = -basis.forward[1];
    const r22 = -basis.forward[2];

    const trace = r00 + r11 + r22;
    let x = 0;
    let y = 0;
    let z = 0;
    let w = 1;
    if (trace > 0) {
        const s = 2 * Math.sqrt(trace + 1);
        w = 0.25 * s;
        x = (r21 - r12) / s;
        y = (r02 - r20) / s;
        z = (r10 - r01) / s;
    } else if (r00 > r11 && r00 > r22) {
        const s = 2 * Math.sqrt(Math.max(1e-8, 1 + r00 - r11 - r22));
        w = (r21 - r12) / s;
        x = 0.25 * s;
        y = (r01 + r10) / s;
        z = (r02 + r20) / s;
    } else if (r11 > r22) {
        const s = 2 * Math.sqrt(Math.max(1e-8, 1 + r11 - r00 - r22));
        w = (r02 - r20) / s;
        x = (r01 + r10) / s;
        y = 0.25 * s;
        z = (r12 + r21) / s;
    } else {
        const s = 2 * Math.sqrt(Math.max(1e-8, 1 + r22 - r00 - r11));
        w = (r10 - r01) / s;
        x = (r02 + r20) / s;
        y = (r12 + r21) / s;
        z = 0.25 * s;
    }
    const norm = Math.hypot(x, y, z, w) || 1;
    return { x: x / norm, y: y / norm, z: z / norm, w: w / norm };
}

function quaternionToBasis(q: GyroQuaternion): {
    right: [number, number, number];
    up: [number, number, number];
    forward: [number, number, number];
} {
    const norm = Math.hypot(q.x, q.y, q.z, q.w) || 1;
    const x = q.x / norm;
    const y = q.y / norm;
    const z = q.z / norm;
    const w = q.w / norm;

    const right: [number, number, number] = [
        1 - 2 * (y * y + z * z),
        2 * (x * y + z * w),
        2 * (x * z - y * w),
    ];
    const up: [number, number, number] = [
        2 * (x * y - z * w),
        1 - 2 * (x * x + z * z),
        2 * (y * z + x * w),
    ];
    const forward: [number, number, number] = [
        -2 * (x * z + y * w),
        -2 * (y * z - x * w),
        -(1 - 2 * (x * x + y * y)),
    ];
    return { right, up, forward };
}

function deviceOrientationBasis(o: GyroOrientation): {
    right: [number, number, number];
    up: [number, number, number];
    forward: [number, number, number];
} {
    if (o.q) {
        return quaternionToBasis(o.q);
    }
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
    const devRight: [number, number, number] = [
        cA * cG - sA * sB * sG,
        sA * cG + cA * sB * sG,
        -cB * sG,
    ];
    const devUp: [number, number, number] = [
        -sA * cB,
        cA * cB,
        sB,
    ];
    const forward = deviceOrientationForwardVector(o);

    const screenRad = normalizeAngleDeg(o.screenAngleDeg ?? 0) * deg2rad;
    if (Math.abs(screenRad) < 1e-4) {
        return { right: devRight, up: devUp, forward };
    }
    // 画面回転角 screenAngleDeg に合わせてカメラローカルの right/up を補正
    const cs = Math.cos(-screenRad);
    const ss = Math.sin(-screenRad);
    const right: [number, number, number] = [
        devRight[0] * cs + devUp[0] * ss,
        devRight[1] * cs + devUp[1] * ss,
        devRight[2] * cs + devUp[2] * ss,
    ];
    const up: [number, number, number] = [
        -devRight[0] * ss + devUp[0] * cs,
        -devRight[1] * ss + devUp[1] * cs,
        -devRight[2] * ss + devUp[2] * cs,
    ];
    return { right, up, forward };
}

/**
 * ジャイロセンサー姿勢をクォータニオン空間で最短経路平滑化する（beta≈90°付近のジンバルロック・±180°フリップ防止）
 */
export function smoothDeviceOrientation(
    prev: GyroOrientation | null,
    nextRaw: GyroOrientation,
    smoothFactor = 0.35,
): GyroOrientation {
    const rawBasis = deviceOrientationBasis({
        alpha: nextRaw.alpha,
        beta: nextRaw.beta,
        gamma: nextRaw.gamma,
        screenAngleDeg: nextRaw.screenAngleDeg,
    });
    const qNext = basisToQuaternion(rawBasis);
    if (!prev) {
        return {
            alpha: normalizeAngleDeg(nextRaw.alpha),
            beta: clampFinite(nextRaw.beta, -180, 180, 0),
            gamma: clampFinite(nextRaw.gamma, -90, 90, 0),
            screenAngleDeg: nextRaw.screenAngleDeg ?? 0,
            q: qNext,
        };
    }

    const qPrev = prev.q ?? basisToQuaternion(deviceOrientationBasis(prev));
    const t = clampFinite(smoothFactor, 0.05, 1, 0.35);
    const dot = qPrev.x * qNext.x + qPrev.y * qNext.y + qPrev.z * qNext.z + qPrev.w * qNext.w;
    const sign = dot < 0 ? -1 : 1;

    const ix = qPrev.x * (1 - t) + qNext.x * sign * t;
    const iy = qPrev.y * (1 - t) + qNext.y * sign * t;
    const iz = qPrev.z * (1 - t) + qNext.z * sign * t;
    const iw = qPrev.w * (1 - t) + qNext.w * sign * t;
    const norm = Math.hypot(ix, iy, iz, iw) || 1;

    return {
        alpha: normalizeAngleDeg(nextRaw.alpha),
        beta: clampFinite(nextRaw.beta, -180, 180, 0),
        gamma: clampFinite(nextRaw.gamma, -90, 90, 0),
        screenAngleDeg: nextRaw.screenAngleDeg ?? 0,
        q: { x: ix / norm, y: iy / norm, z: iz / norm, w: iw / norm },
    };
}

/**
 * ジャイロセンサー（DeviceOrientation）の3D回転行列差分・クォータニオン（ジンバルロック耐性）から、
 * 現在のカメラ画面（任意の傾き・縦横向き）への正確な透視投影オフセットを計算する
 */
export function calculateGyroParallaxOffset(
    current: GyroOrientation,
    base: GyroOrientation,
    canvasWidth: number,
    canvasHeight: number,
    sensitivity = 1.0,
    anchorRatioX = 0.5,
    anchorRatioY = 0.5,
): { offsetX: number; offsetY: number; tiltSkewDeg: number } {
    const safeW = clampFinite(canvasWidth, 100, 8000, 1280);
    const safeH = clampFinite(canvasHeight, 100, 8000, 720);
    const sens = clampFinite(sensitivity, 0.1, 3.0, 1.0);
    const ax = clampFinite(anchorRatioX, -0.5, 1.5, 0.5);
    const ay = clampFinite(anchorRatioY, -0.5, 1.5, 0.5);

    const baseBasis = deviceOrientationBasis(base);
    const curBasis = deviceOrientationBasis(current);

    // 縦持ちスマホ(約72°) / 横持ち(約52°)の実画角に合わせた正方形ピクセル焦点距離
    const verticalFovDeg = safeH > safeW ? 72 : 52;
    const focalPx = ((safeH * 0.5) / Math.tan((verticalFovDeg * Math.PI) / 360)) * sens;

    // 基準姿勢でアンカー(ax, ay)が指していたワールド空間方向ベクトル
    const localAx = ((ax - 0.5) * safeW) / focalPx;
    const localAy = -((ay - 0.5) * safeH) / focalPx;
    const localNorm = Math.hypot(localAx, localAy, 1) || 1;
    const ldx = localAx / localNorm;
    const ldy = localAy / localNorm;
    const ldz = 1 / localNorm;

    const anchorWorld: [number, number, number] = [
        ldx * baseBasis.right[0] + ldy * baseBasis.up[0] + ldz * baseBasis.forward[0],
        ldx * baseBasis.right[1] + ldy * baseBasis.up[1] + ldz * baseBasis.forward[1],
        ldx * baseBasis.right[2] + ldy * baseBasis.up[2] + ldz * baseBasis.forward[2],
    ];

    // 現在のカメラ座標系（端末の傾き・ロールを含む）へ透視投影
    const relX =
        anchorWorld[0] * curBasis.right[0] +
        anchorWorld[1] * curBasis.right[1] +
        anchorWorld[2] * curBasis.right[2];
    const relY =
        anchorWorld[0] * curBasis.up[0] +
        anchorWorld[1] * curBasis.up[1] +
        anchorWorld[2] * curBasis.up[2];
    const relZ =
        anchorWorld[0] * curBasis.forward[0] +
        anchorWorld[1] * curBasis.forward[1] +
        anchorWorld[2] * curBasis.forward[2];

    const denom = Math.max(0.2, relZ);
    const projOffsetX = focalPx * (relX / denom) - (ax - 0.5) * safeW;
    const projOffsetY = -focalPx * (relY / denom) - (ay - 0.5) * safeH;

    const offsetX = clampFinite(projOffsetX, -safeW * 1.5, safeW * 1.5, 0);
    const offsetY = clampFinite(projOffsetY, -safeH * 1.5, safeH * 1.5, 0);

    // 相対回転クォータニオン q_rel = q_cur^-1 * q_base の視線軸(Z) Twist 成分から純粋なロール傾きを抽出
    const qBase = base.q ?? basisToQuaternion(baseBasis);
    const qCur = current.q ?? basisToQuaternion(curBasis);
    // q_cur^-1 = (-x, -y, -z, w)
    const relQw = qCur.w * qBase.w + qCur.x * qBase.x + qCur.y * qBase.y + qCur.z * qBase.z;
    const relQz = qCur.w * qBase.z - qCur.x * qBase.y + qCur.y * qBase.x - qCur.z * qBase.w;
    const twistNorm = Math.hypot(relQz, relQw) || 1;
    const signW = relQw < 0 ? -1 : 1;
    const twistRad = 2 * Math.atan2((relQz / twistNorm) * signW, (relQw / twistNorm) * signW);
    const tiltSkewDeg = clampFinite(-(twistRad * 180) / Math.PI, -45, 45, 0);

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

export interface DepthOcclusionMaskOptions {
    /** 細い手前構造（柵・手すり・支柱）の局所ピーク強調と微小ギャップ補完を有効にする */
    preserveThinStructures?: boolean;
    /** 元映像のガイドRGBA配列（指定時は深度境界を元映像の輪郭に追従させる） */
    guideRgba?: Uint8ClampedArray;
    /** ガイド画像の幅 */
    guideWidth?: number;
    /** ガイド画像の高さ */
    guideHeight?: number;
}

/**
 * 細い手前構造（柵・手すり・支柱など）の局所ピーク強調と1pxギャップ補完を適用した深度配列を生成する
 */
function enhanceThinStructuresInDepth(
    normalizedDepth: ArrayLike<number>,
    width: number,
    height: number,
    threshold: number,
): Float32Array {
    const total = width * height;
    const boosted = new Float32Array(total);

    // 1. 5x5 近傍平均との差分から局所的な手前突出（細い柵・棒）を強調
    for (let y = 0; y < height; y++) {
        const y0 = Math.max(0, y - 2);
        const y1 = Math.min(height - 1, y + 2);
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const d = idx < normalizedDepth.length ? clampFinite(normalizedDepth[idx], 0, 1, 0) : 0;
            const x0 = Math.max(0, x - 2);
            const x1 = Math.min(width - 1, x + 2);
            let sum = 0;
            let cnt = 0;
            for (let sy = y0; sy <= y1; sy++) {
                const row = sy * width;
                for (let sx = x0; sx <= x1; sx++) {
                    const sIdx = row + sx;
                    sum += sIdx < normalizedDepth.length ? clampFinite(normalizedDepth[sIdx], 0, 1, 0) : 0;
                    cnt++;
                }
            }
            const localAvg = sum / Math.max(1, cnt);
            const ridge = d - localAvg;
            // 背景より手前に明確に突き出た細い構造（柵・手すり等）のみ局所ピークを補正し、緩やかな壁・床の誤強調を防ぐ
            boosted[idx] = ridge > 0.025 ? clampFinite(d + Math.min(0.055, ridge * 0.85), 0, 1, d) : d;
        }
    }

    // 2. 細い柵の1px途切れを防ぐ方向性ギャップ補完（左右・上下・対角のいずれかが両方閾値超えなら補完）
    const closed = new Float32Array(boosted);
    for (let y = 1; y < height - 1; y++) {
        const row = y * width;
        for (let x = 1; x < width - 1; x++) {
            const idx = row + x;
            if (boosted[idx] > threshold) continue;
            const l = boosted[idx - 1];
            const r = boosted[idx + 1];
            const u = boosted[idx - width];
            const dn = boosted[idx + width];
            const ul = boosted[idx - width - 1];
            const dr = boosted[idx + width + 1];
            const ur = boosted[idx - width + 1];
            const dl = boosted[idx + width - 1];

            let bridgeVal = 0;
            if (l > threshold && r > threshold) bridgeVal = Math.max(bridgeVal, Math.min(l, r));
            if (u > threshold && dn > threshold) bridgeVal = Math.max(bridgeVal, Math.min(u, dn));
            if (ul > threshold && dr > threshold) bridgeVal = Math.max(bridgeVal, Math.min(ul, dr));
            if (ur > threshold && dl > threshold) bridgeVal = Math.max(bridgeVal, Math.min(ur, dl));
            if (bridgeVal > 0) {
                closed[idx] = bridgeVal;
            }
        }
    }
    return closed;
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
    options?: DepthOcclusionMaskOptions,
): Uint8ClampedArray {
    const safeW = Math.max(1, Math.floor(clampFinite(width, 1, 4096, 1)));
    const safeH = Math.max(1, Math.floor(clampFinite(height, 1, 4096, 1)));
    const total = safeW * safeH;
    const threshold = clampFinite(threshold01, 0, 1, 0.55);
    const safeFeather = clampFinite(feather, 0.001, 0.25, 0.015);

    const depthSource: ArrayLike<number> =
        options?.preserveThinStructures && safeW >= 5 && safeH >= 5
            ? enhanceThinStructuresInDepth(normalizedDepth, safeW, safeH, threshold)
            : normalizedDepth;

    const guide = options?.guideRgba;
    const guideW = Math.floor(clampFinite(options?.guideWidth ?? 0, 0, 4096, 0));
    const guideH = Math.floor(clampFinite(options?.guideHeight ?? 0, 0, 4096, 0));
    const useGuide =
        Boolean(guide) &&
        guideW >= 8 &&
        guideH >= 8 &&
        guide!.length >= guideW * guideH * 4;

    if (useGuide && guide) {
        const out = new Uint8ClampedArray(guideW * guideH * 4);
        // ガイド色類似度に基づく Joint Bilateral アップサンプリングで、柵や手すりの輪郭にピタッと追従させる
        const invTwoSigmaColorSq = 1 / (2 * 28 * 28);
        const scaleX = safeW / guideW;
        const scaleY = safeH / guideH;

        for (let gy = 0; gy < guideH; gy++) {
            const fy = (gy + 0.5) * scaleY - 0.5;
            const cy = Math.round(fy);
            for (let gx = 0; gx < guideW; gx++) {
                const gIdx = (gy * guideW + gx) * 4;
                const r0 = guide[gIdx];
                const g0 = guide[gIdx + 1];
                const b0 = guide[gIdx + 2];

                const fx = (gx + 0.5) * scaleX - 0.5;
                const cx = Math.round(fx);

                let wSum = 0;
                let dSum = 0;
                for (let oy = -1; oy <= 1; oy++) {
                    const sy = Math.min(safeH - 1, Math.max(0, cy + oy));
                    const sgy = Math.min(guideH - 1, Math.max(0, Math.round(((sy + 0.5) / safeH) * guideH - 0.5)));
                    for (let ox = -1; ox <= 1; ox++) {
                        const sx = Math.min(safeW - 1, Math.max(0, cx + ox));
                        const sgx = Math.min(guideW - 1, Math.max(0, Math.round(((sx + 0.5) / safeW) * guideW - 0.5)));

                        const sgIdx = (sgy * guideW + sgx) * 4;
                        const dr = r0 - guide[sgIdx];
                        const dg = g0 - guide[sgIdx + 1];
                        const db = b0 - guide[sgIdx + 2];
                        const colorSq = dr * dr + dg * dg + db * db;
                        const spatialW = ox === 0 && oy === 0 ? 1.0 : ox === 0 || oy === 0 ? 0.72 : 0.48;
                        const w = spatialW * Math.exp(-colorSq * invTwoSigmaColorSq);

                        const dIdx = sy * safeW + sx;
                        const dVal = dIdx < depthSource.length ? clampFinite(depthSource[dIdx], 0, 1, 0) : 0;
                        wSum += w;
                        dSum += w * dVal;
                    }
                }

                const d = wSum > 1e-6 ? dSum / wSum : 0;
                if (d <= threshold - safeFeather) continue;

                let alphaRatio = 1;
                if (d < threshold + safeFeather) {
                    alphaRatio = (d - (threshold - safeFeather)) / (safeFeather * 2);
                }
                const alpha = Math.round(clampFinite(alphaRatio, 0, 1, 0) * 255);
                if (alpha >= 24) {
                    out[gIdx] = 255;
                    out[gIdx + 1] = 0;
                    out[gIdx + 2] = 0;
                    out[gIdx + 3] = alpha;
                }
            }
        }
        return out;
    }

    const out = new Uint8ClampedArray(total * 4);
    for (let i = 0; i < total && i < depthSource.length; i++) {
        const d = clampFinite(depthSource[i], 0, 1, 0);
        if (d <= threshold - safeFeather) continue;

        let alphaRatio = 1;
        if (d < threshold + safeFeather) {
            alphaRatio = (d - (threshold - safeFeather)) / (safeFeather * 2);
        }
        const alpha = Math.round(clampFinite(alphaRatio, 0, 1, 0) * 255);
        if (alpha >= 24) {
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
 * キャラクター足元周辺の深度サンプルから接地床面（下位30%点）を推定する。
 * 足元に手前の柵や手すりが重なっていても、手前の外れ値に引きずられず奥の床深度を拾える。
 */
export function estimateCharacterGroundDepth(
    normalizedDepth: ArrayLike<number>,
    width: number,
    height: number,
    nx: number,
    ny: number,
): number {
    const safeW = Math.max(1, Math.floor(clampFinite(width, 1, 4096, 1)));
    const safeH = Math.max(1, Math.floor(clampFinite(height, 1, 4096, 1)));
    if (normalizedDepth.length < safeW * safeH) return 0.5;

    const cx = clampFinite(nx, 0.05, 0.95, 0.5);
    const cy = clampFinite(ny, 0.05, 0.95, 0.78);
    const samples: number[] = [];

    for (let iy = -2; iy <= 2; iy++) {
        const syNorm = clampFinite(cy + iy * 0.025, 0, 1, cy);
        const py = Math.round(syNorm * (safeH - 1));
        for (let ix = -2; ix <= 2; ix++) {
            const sxNorm = clampFinite(cx + ix * 0.04, 0, 1, cx);
            const px = Math.round(sxNorm * (safeW - 1));
            const v = normalizedDepth[py * safeW + px];
            if (Number.isFinite(v)) {
                samples.push(clampFinite(v, 0, 1, 0.5));
            }
        }
    }
    if (samples.length === 0) return 0.5;
    samples.sort((a, b) => a - b);
    const percentileIdx = Math.min(samples.length - 1, Math.floor(samples.length * 0.3));
    return samples[percentileIdx];
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

export interface ArDepthDistanceParams {
    normalizedDepth: ArrayLike<number>;
    width: number;
    height: number;
    footXRatio: number;
    footYRatio: number;
    verticalFovDeg?: number;
    cameraHeightM?: number;
    pitchTiltDeg?: number;
}

/**
 * AR深度マップ上のキャラクター足元位置とカメラ画角・接地ジオメトリから、
 * カメラ〜キャラクター足元までの推定距離 (m: 0.5..18.0) を算出する
 */
export function estimateDistanceFromArDepth(params: ArDepthDistanceParams): number {
    const safeW = Math.max(1, Math.floor(clampFinite(params.width, 1, 4096, 1)));
    const safeH = Math.max(1, Math.floor(clampFinite(params.height, 1, 4096, 1)));
    const nx = clampFinite(params.footXRatio, 0.05, 0.95, 0.5);
    const ny = clampFinite(params.footYRatio, 0.05, 0.95, 0.78);
    const fovRad = (clampFinite(params.verticalFovDeg ?? 74, 25, 110, 74) * Math.PI) / 180;
    const camHeight = clampFinite(params.cameraHeightM ?? 1.35, 0.4, 3.0, 1.35);
    const pitchDeg = clampFinite(params.pitchTiltDeg ?? 8, -30, 45, 8);

    const groundDepth = estimateCharacterGroundDepth(params.normalizedDepth, safeW, safeH, nx, ny);
    // 相対逆深度（0=奥 .. 1=手前）からの距離推定
    const depthDistM = 1.15 / Math.max(0.08, groundDepth + 0.08);

    // 地上カメラ幾何学による足元投影距離（画面下半分に接地している場合に有効）
    const rayAngleFromCenterRad = Math.atan((2 * ny - 1) * Math.tan(fovRad / 2));
    const downwardAngleRad = rayAngleFromCenterRad + (pitchDeg * Math.PI) / 180;
    let blendedDistM = depthDistM;
    if (downwardAngleRad > 0.06 && ny >= 0.5) {
        const geomDistM = clampFinite(camHeight / Math.tan(downwardAngleRad), 0.5, 18.0, depthDistM);
        blendedDistM = depthDistM * 0.6 + geomDistM * 0.4;
    }

    return Math.round(clampFinite(blendedDistM, 0.5, 18.0, 2.5) * 10) / 10;
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

export interface CharacterColorAdaptation {
    /** 明るさ補正係数 (0.55..1.18) */
    brightness: number;
    /** 彩度補正係数 (0.72..1.05) */
    saturate: number;
    /** 環境光の馴染ませ色 */
    tintRgb: { r: number; g: number; b: number };
    /** 環境光ティントの不透明度 (0.08..0.34) */
    tintAlpha: number;
    /** 光源の左右方向 (-1=左, +1=右) */
    rimDirX: number;
    /** 反対側の立体陰影の強さ (0.06..0.22) */
    shadeAlpha: number;
}

/**
 * 背景から推定した環境光（輝度・RGB平均色）と光源方位角から、
 * 立ち絵を背景の空気感・色温度に馴染ませる色補正パラメータを算出する
 */
export function calculateCharacterColorAdaptation(
    lighting: EnvironmentLighting,
    azimuthDeg: number,
): CharacterColorAdaptation {
    const lum = clampFinite(lighting.luminance, 0, 1, 0.5);
    const brightness = clampFinite(lighting.brightnessMultiplier, 0.55, 1.18, 1.0);
    // 暗い環境ほど少し彩度を落として馴染ませる
    const saturate = clampFinite(0.74 + lum * 0.30, 0.72, 1.05, 0.95);

    const ar = clampFinite(lighting.ambientColor?.r ?? 128, 0, 255, 128);
    const ag = clampFinite(lighting.ambientColor?.g ?? 128, 0, 255, 128);
    const ab = clampFinite(lighting.ambientColor?.b ?? 128, 0, 255, 128);

    // 極端な原色被りを防ぐため、背景色とニュートラル寄りを適度にブレンド
    const tintRgb = {
        r: Math.round(ar * 0.78 + 255 * 0.22 * lum),
        g: Math.round(ag * 0.78 + 255 * 0.22 * lum),
        b: Math.round(ab * 0.78 + 255 * 0.22 * lum),
    };

    // 暗い・色被りの強い環境ほど馴染ませ強度を強める
    const tintAlpha = clampFinite(0.14 + (1 - lum) * 0.18, 0.10, 0.34, 0.20);
    const azRad = (normalizeAngleDeg(azimuthDeg) * Math.PI) / 180;
    const rimDirX = Math.sin(azRad); // 90°=右(+1), 270°=左(-1)
    const shadeAlpha = clampFinite(0.08 + (1 - lum) * 0.12, 0.06, 0.22, 0.12);

    return {
        brightness,
        saturate,
        tintRgb,
        tintAlpha,
        rimDirX,
        shadeAlpha,
    };
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

/**
 * 基準グレースケールフレームと現在フレームを照合し、
 * 平行移動 (dx, dy) とカメラの近づき・離れに伴う放射拡大縮小率 (scale) を推定する
 * （3段階 Coarse-to-Fine 探索 + キャラクター足元アンカー重み付けにより高さ変更時の上下追従も高速高精度化）
 */
export function estimateBackgroundScaleAndShift(
    prevGray: Uint8Array,
    currGray: Uint8Array,
    width: number,
    height: number,
    maxShiftPx = 18,
    anchorXRatio = 0.5,
    anchorYRatio = 0.78,
): { dx: number; dy: number; scale: number; confidence: number } {
    const safeW = Math.max(16, Math.floor(clampFinite(width, 16, 512, 64)));
    const safeH = Math.max(16, Math.floor(clampFinite(height, 16, 512, 64)));
    const total = safeW * safeH;
    if (prevGray.length < total || currGray.length < total) {
        return { dx: 0, dy: 0, scale: 1, confidence: 0 };
    }

    const search = Math.floor(clampFinite(maxShiftPx, 2, 32, 18));
    const margin = Math.max(3, Math.floor(Math.min(safeW, safeH) * 0.12));
    const cx = (safeW - 1) * 0.5;
    const cy = (safeH - 1) * 0.5;
    const ax = clampFinite(anchorXRatio, 0.05, 0.95, 0.5) * (safeW - 1);
    const ay = clampFinite(anchorYRatio, 0.05, 0.95, 0.78) * (safeH - 1);
    const invTwoSigmaSq = 1 / (2 * Math.pow(Math.max(8, Math.min(safeW, safeH) * 0.35), 2));

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
    if (variance < 16 || count < 16) {
        return { dx: 0, dy: 0, scale: 1, confidence: 0 };
    }

    const evalCandidate = (s: number, dx: number, dy: number, pxStep: number): number => {
        let weightedSad = 0;
        let weightSum = 0;
        let samples = 0;
        const expectedCount =
            Math.ceil((safeH - margin * 2) / pxStep) * Math.ceil((safeW - margin * 2) / pxStep);
        for (let y = margin; y < safeH - margin; y += pxStep) {
            const sy = Math.round(cy + (y - cy) * s + dy);
            if (sy < 1 || sy >= safeH - 1) continue;
            const pRow = y * safeW;
            const cRow = sy * safeW;
            const dyA = y - ay;
            for (let x = margin; x < safeW - margin; x += pxStep) {
                const sx = Math.round(cx + (x - cx) * s + dx);
                if (sx < 1 || sx >= safeW - 1) continue;
                const dxA = x - ax;
                const w = 1 + 1.8 * Math.exp(-(dxA * dxA + dyA * dyA) * invTwoSigmaSq);
                weightedSad += w * Math.abs(currGray[cRow + sx] - prevGray[pRow + x]);
                weightSum += w;
                samples++;
            }
        }
        if (samples < Math.max(10, expectedCount * 0.32) || weightSum <= 0) return Infinity;
        return weightedSad / weightSum;
    };

    const zeroSad = evalCandidate(1.0, 0, 0, 2);
    let bestScale = 1.0;
    let bestDx = 0;
    let bestDy = 0;
    let bestSad = Infinity;

    // Stage 1: 広域粗探索 (上下高さ変化による大きいシフトもカバー)
    const coarseStep = search > 10 ? 3 : 2;
    const coarseScales = [0.72, 0.86, 1.0, 1.15, 1.35, 1.6];
    for (const s of coarseScales) {
        for (let dy = -search; dy <= search; dy += coarseStep) {
            for (let dx = -search; dx <= search; dx += coarseStep) {
                const avgSad = evalCandidate(s, dx, dy, 3);
                if (avgSad < bestSad) {
                    bestSad = avgSad;
                    bestScale = s;
                    bestDx = dx;
                    bestDy = dy;
                }
            }
        }
    }

    // Stage 2: 中間探索
    const midCenterS = bestScale;
    const midCenterDx = bestDx;
    const midCenterDy = bestDy;
    bestSad = Infinity;
    for (let ds = -0.08; ds <= 0.081; ds += 0.04) {
        const s = clampFinite(midCenterS + ds, 0.55, 1.85, 1.0);
        for (let dy = midCenterDy - coarseStep; dy <= midCenterDy + coarseStep; dy += 2) {
            for (let dx = midCenterDx - coarseStep; dx <= midCenterDx + coarseStep; dx += 2) {
                const avgSad = evalCandidate(s, dx, dy, 2);
                if (avgSad < bestSad) {
                    bestSad = avgSad;
                    bestScale = s;
                    bestDx = dx;
                    bestDy = dy;
                }
            }
        }
    }

    // Stage 3: 1px精度の精密探索
    const fineCenterS = bestScale;
    const fineCenterDx = bestDx;
    const fineCenterDy = bestDy;
    for (let ds = -0.03; ds <= 0.031; ds += 0.015) {
        const s = clampFinite(fineCenterS + ds, 0.55, 1.85, 1.0);
        for (let dy = fineCenterDy - 1; dy <= fineCenterDy + 1; dy++) {
            for (let dx = fineCenterDx - 1; dx <= fineCenterDx + 1; dx++) {
                const avgSad = evalCandidate(s, dx, dy, 2);
                if (avgSad < bestSad) {
                    bestSad = avgSad;
                    bestScale = s;
                    bestDx = dx;
                    bestDy = dy;
                }
            }
        }
    }

    if (!Number.isFinite(bestSad) || bestSad > 34) {
        return { dx: 0, dy: 0, scale: 1, confidence: 0 };
    }

    const improvement =
        Number.isFinite(zeroSad) && zeroSad > 0
            ? clampFinite((zeroSad - bestSad) / zeroSad, 0, 1, 0)
            : 0;
    const confidence =
        bestScale === 1.0 && bestDx === 0 && bestDy === 0
            ? 0.5
            : clampFinite(improvement * 2.2, 0.1, 1, 0.5);

    return {
        dx: bestDx,
        dy: bestDy,
        scale: Math.round(clampFinite(bestScale, 0.55, 1.85, 1.0) * 1000) / 1000,
        confidence,
    };
}

export interface SurfacePlaneAnalysis {
    /** ピクセル単位の面分類 (0=その他, 1=地面・床, 2=壁・垂直面) */
    labels: Uint8Array;
    /** 画面全体に占める地面の割合 (0..1) */
    groundRatio: number;
    /** 画面全体に占める壁の割合 (0..1) */
    wallRatio: number;
    /** 検出された地面と壁の境界位置 (0.2..0.85) */
    horizonYRatio: number;
    /** 検出された地面領域内の推奨接地Y位置 (0.35..0.9) */
    recommendedFootYRatio: number;
}

/**
 * 正規化深度マップ（0=奥 .. 1=手前）の垂直・水平深度勾配から
 * 「地面（水平面）」と「壁（垂直面）」およびその境界線を認識する
 */
export function analyzeGroundAndWallPlanes(
    normalizedDepth: ArrayLike<number>,
    width: number,
    height: number,
): SurfacePlaneAnalysis {
    const safeW = Math.max(1, Math.floor(clampFinite(width, 1, 4096, 1)));
    const safeH = Math.max(1, Math.floor(clampFinite(height, 1, 4096, 1)));
    const total = safeW * safeH;
    const labels = new Uint8Array(total);
    if (normalizedDepth.length < total || safeW < 5 || safeH < 5) {
        return {
            labels,
            groundRatio: 0,
            wallRatio: 0,
            horizonYRatio: 0.55,
            recommendedFootYRatio: 0.78,
        };
    }

    const step = Math.max(2, Math.floor(Math.min(safeW, safeH) * 0.025));
    let groundCount = 0;
    let wallCount = 0;
    let firstGroundRow = -1;
    let groundYWeightedSum = 0;

    for (let y = 0; y < safeH; y++) {
        const yUp = Math.max(0, y - step);
        const yDn = Math.min(safeH - 1, y + step);
        const dySpan = Math.max(1, yDn - yUp);
        let rowGround = 0;

        for (let x = 0; x < safeW; x++) {
            const xL = Math.max(0, x - step);
            const xR = Math.min(safeW - 1, x + step);
            const dxSpan = Math.max(1, xR - xL);

            const idx = y * safeW + x;
            const d = clampFinite(normalizedDepth[idx], 0, 1, 0);
            const gy =
                (clampFinite(normalizedDepth[yDn * safeW + x], 0, 1, d) -
                    clampFinite(normalizedDepth[yUp * safeW + x], 0, 1, d)) /
                dySpan;
            const gx =
                (clampFinite(normalizedDepth[y * safeW + xR], 0, 1, d) -
                    clampFinite(normalizedDepth[y * safeW + xL], 0, 1, d)) /
                dxSpan;

            const normalizedGy = gy * safeH;
            const normalizedGx = gx * safeW;

            if (y >= safeH * 0.25 && normalizedGy > 0.12 && normalizedGy > Math.abs(normalizedGx) * 0.65) {
                labels[idx] = 1;
                groundCount++;
                rowGround++;
                groundYWeightedSum += y / Math.max(1, safeH - 1);
            } else if (Math.abs(normalizedGy) <= 0.14 && d > 0.06) {
                labels[idx] = 2;
                wallCount++;
            }
        }

        if (firstGroundRow < 0 && rowGround >= safeW * 0.18) {
            firstGroundRow = y;
        }
    }

    const groundRatio = clampFinite(groundCount / total, 0, 1, 0);
    const wallRatio = clampFinite(wallCount / total, 0, 1, 0);
    const horizonYRatio =
        firstGroundRow >= 0
            ? clampFinite(firstGroundRow / Math.max(1, safeH - 1), 0.2, 0.85, 0.55)
            : 0.55;
    const avgGroundY = groundCount > 0 ? groundYWeightedSum / groundCount : 0.78;
    const recommendedFootYRatio = clampFinite(
        Math.max(horizonYRatio + 0.12, avgGroundY),
        0.35,
        0.9,
        0.78,
    );

    return {
        labels,
        groundRatio,
        wallRatio,
        horizonYRatio,
        recommendedFootYRatio,
    };
}

/**
 * 認識した地面(1)と壁(2)のラベルマップからARプレビュー用の半透明認識オーバーレイ RGBA を生成する
 */
export function generateSurfaceOverlayPixels(
    labels: Uint8Array,
    width: number,
    height: number,
): Uint8ClampedArray {
    const safeW = Math.max(1, Math.floor(clampFinite(width, 1, 4096, 1)));
    const safeH = Math.max(1, Math.floor(clampFinite(height, 1, 4096, 1)));
    const total = safeW * safeH;
    const out = new Uint8ClampedArray(total * 4);
    if (labels.length < total) return out;

    for (let y = 0; y < safeH; y++) {
        const isGridY = y % 16 === 0;
        for (let x = 0; x < safeW; x++) {
            const idx = y * safeW + x;
            const label = labels[idx];
            const p = idx * 4;
            const isGrid = isGridY || x % 16 === 0;

            if (label === 1) {
                out[p] = 16;
                out[p + 1] = 185;
                out[p + 2] = 129;
                out[p + 3] = isGrid ? 62 : 20;
            } else if (label === 2) {
                out[p] = 99;
                out[p + 1] = 102;
                out[p + 2] = 241;
                out[p + 3] = isGrid ? 42 : 14;
            }
        }
    }
    return out;
}
