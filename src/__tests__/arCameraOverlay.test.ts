import { describe, it, expect } from "vitest";
import {
    clampFinite,
    normalizeAngleDeg,
    shortestAngleDeltaDeg,
    analyzeImageAlphaBounds,
    estimateEnvironmentLighting,
    calculateProjectedShadowTransform,
    calculateGyroParallaxOffset,
    smoothDeviceOrientation,
    createShadowSilhouettePixels,
    isSupportedImageFile,
    normalizeDepthMap,
    generateDepthOcclusionMaskPixels,
    estimateCharacterGroundDepth,
    estimateDistanceFromArDepth,
    calculateScaleForCharacterHeight,
    estimateGroundTiltFromDepthMap,
    generateGroundShadowMaskPixels,
    estimateBackgroundOpticalShift,
    estimateBackgroundScaleAndShift,
    analyzeGroundAndWallPlanes,
    generateSurfaceOverlayPixels,
    calculateApertureMaxBlurPx,
    generateDofOutOfFocusMaskPixels,
    sampleDepthAtNormalizedPoint,
    calculateCharacterColorAdaptation,
} from "../utils/arCameraOverlay";

describe("arCameraOverlay utilities", () => {
    it("clampFinite: handles NaN, Infinity, and out-of-range values safely", () => {
        expect(clampFinite(NaN, 0, 100, 50)).toBe(50);
        expect(clampFinite(Infinity, 0, 100, 50)).toBe(50);
        expect(clampFinite(-10, 0, 100, 50)).toBe(0);
        expect(clampFinite(150, 0, 100, 50)).toBe(100);
        expect(clampFinite(42.5, 0, 100, 50)).toBe(42.5);
    });

    it("normalizeAngleDeg & shortestAngleDeltaDeg: wraps angles cleanly across 0/360 boundary", () => {
        expect(normalizeAngleDeg(-45)).toBe(315);
        expect(normalizeAngleDeg(405)).toBe(45);
        expect(normalizeAngleDeg(NaN)).toBe(0);

        expect(shortestAngleDeltaDeg(10, 350)).toBe(20);
        expect(shortestAngleDeltaDeg(350, 10)).toBe(-20);
        expect(shortestAngleDeltaDeg(180, 0)).toBe(180);
    });

    it("analyzeImageAlphaBounds: detects opaque bounding box and foot anchor ignoring transparent margins", () => {
        const width = 4;
        const height = 4;
        const data = new Uint8ClampedArray(width * height * 4);
        const setOpaque = (x: number, y: number) => {
            const idx = (y * width + x) * 4;
            data[idx] = 200;
            data[idx + 1] = 100;
            data[idx + 2] = 50;
            data[idx + 3] = 255;
        };
        setOpaque(1, 1);
        setOpaque(2, 1);
        setOpaque(1, 2);
        setOpaque(2, 2);

        const bounds = analyzeImageAlphaBounds(data, width, height);
        expect(bounds.hasOpaquePixels).toBe(true);
        expect(bounds.minX).toBe(1);
        expect(bounds.maxX).toBe(2);
        expect(bounds.minY).toBe(1);
        expect(bounds.maxY).toBe(2);
        expect(bounds.footCenterXRatio).toBeCloseTo(0.5, 2);
        expect(bounds.footBottomYRatio).toBeCloseTo(0.75, 2);
        expect(bounds.opaqueHeightRatio).toBeCloseTo(0.5, 2);
    });

    it("analyzeImageAlphaBounds: returns safe fallback for fully transparent images", () => {
        const data = new Uint8ClampedArray(4 * 4 * 4);
        const bounds = analyzeImageAlphaBounds(data, 4, 4);
        expect(bounds.hasOpaquePixels).toBe(false);
        expect(bounds.footCenterXRatio).toBe(0.5);
        expect(bounds.footBottomYRatio).toBe(1);
    });

    it("estimateEnvironmentLighting: computes luminance, ambient color, and directional azimuth", () => {
        const data = new Uint8ClampedArray([
            20, 20, 20, 255,   240, 240, 240, 255,
            20, 20, 20, 255,   240, 240, 240, 255,
        ]);
        const lighting = estimateEnvironmentLighting(data, 2, 2);
        expect(lighting.luminance).toBeGreaterThan(0.4);
        expect(lighting.luminance).toBeLessThan(0.6);
        expect(lighting.suggestedAzimuthDeg).toBe(90);
        expect(lighting.brightnessMultiplier).toBeGreaterThanOrEqual(0.6);
        expect(lighting.brightnessMultiplier).toBeLessThanOrEqual(1.18);
    });

    it("calculateProjectedShadowTransform: projects longer shadows at lower sun elevations and respects azimuth direction", () => {
        const lowSun = calculateProjectedShadowTransform({
            azimuthDeg: 0,
            elevationDeg: 15,
            groundTiltDeg: 35,
            shadowOpacity: 0.6,
            shadowSoftness: 0.5,
            characterHeightPx: 400,
            characterWidthPx: 200,
        });
        const highSun = calculateProjectedShadowTransform({
            azimuthDeg: 0,
            elevationDeg: 75,
            groundTiltDeg: 35,
            shadowOpacity: 0.6,
            shadowSoftness: 0.5,
            characterHeightPx: 400,
            characterWidthPx: 200,
        });

        expect(lowSun.scaleYRatio).toBeGreaterThan(0);
        expect(highSun.scaleYRatio).toBeGreaterThan(0);
        expect(Math.abs(lowSun.scaleYRatio)).toBeGreaterThan(Math.abs(highSun.scaleYRatio));
        expect(lowSun.blurPx).toBeGreaterThan(highSun.blurPx);
        expect(lowSun.contactWidthPx).toBeGreaterThan(0);
        expect(lowSun.contactHeightPx).toBeGreaterThan(0);

        const frontLight = calculateProjectedShadowTransform({
            azimuthDeg: 180,
            elevationDeg: 40,
            groundTiltDeg: 35,
            shadowOpacity: 0.5,
            shadowSoftness: 0.4,
            characterHeightPx: 400,
            characterWidthPx: 200,
        });
        expect(frontLight.scaleYRatio).toBeLessThan(0);
    });

    it("calculateGyroParallaxOffset: computes bounded spatial parallax offsets", () => {
        const offset = calculateGyroParallaxOffset(
            { alpha: 15, beta: 40, gamma: 10 },
            { alpha: 0, beta: 45, gamma: 0 },
            1280,
            720,
            1.0,
        );
        expect(offset.offsetX).toBeGreaterThan(0);
        expect(offset.offsetY).toBeLessThan(0);
        expect(Number.isFinite(offset.tiltSkewDeg)).toBe(true);

        // 縦持ち(beta=88°)付近でも安定して向きに応じた有限の視差オフセットを返すこと
        const portraitOffset = calculateGyroParallaxOffset(
            { alpha: 350, beta: 88, gamma: 2 },
            { alpha: 10, beta: 88, gamma: 0 },
            1280,
            720,
            1.0,
        );
        expect(Number.isFinite(portraitOffset.offsetX)).toBe(true);
        expect(portraitOffset.offsetX).toBeLessThan(0);

        // 端末を垂直から大きく傾けた状態(beta=35°, gamma=25°)や非中心アンカーでも破綻せず透視投影されること
        const tiltedBase = { alpha: 30, beta: 45, gamma: 15 };
        const tiltedSame = calculateGyroParallaxOffset(
            tiltedBase,
            tiltedBase,
            720,
            1280,
            1.0,
            0.35,
            0.8,
        );
        expect(Math.abs(tiltedSame.offsetX)).toBeLessThan(1e-6);
        expect(Math.abs(tiltedSame.offsetY)).toBeLessThan(1e-6);
        expect(Math.abs(tiltedSame.tiltSkewDeg)).toBeLessThan(1e-6);
    });

    it("smoothDeviceOrientation: avoids euler flip jumps near beta=90deg using quaternion smoothing", () => {
        const base = smoothDeviceOrientation(null, { alpha: 355, beta: 89, gamma: 15 }, 1.0);
        // beta≈90°付近では alpha と gamma が同一軸に重なり、alpha+gamma が同じなら物理的にほぼ同じ姿勢
        const equivalentNearGimbal = smoothDeviceOrientation(
            base,
            { alpha: 15, beta: 91, gamma: -5 },
            0.35,
        );
        const offset = calculateGyroParallaxOffset(equivalentNearGimbal, base, 720, 1280, 1.0);
        expect(Math.abs(offset.offsetX)).toBeLessThan(20);
        expect(Math.abs(offset.offsetY)).toBeLessThan(40);
    });

    it("createShadowSilhouettePixels: preserves alpha channel and replaces RGB with shadow color", () => {
        const src = new Uint8ClampedArray([
            255, 120, 80, 200,
            10, 20, 30, 0,
        ]);
        const out = createShadowSilhouettePixels(src, { r: 15, g: 20, b: 35 });
        expect(Array.from(out)).toEqual([
            15, 20, 35, 200,
            0, 0, 0, 0,
        ]);
    });

    it("isSupportedImageFile: accepts cloud drive files with empty or octet-stream MIME types by extension", () => {
        expect(isSupportedImageFile("chara.png", "")).toBe(true);
        expect(isSupportedImageFile("chara.WEBP", "application/octet-stream")).toBe(true);
        expect(isSupportedImageFile("photo", "image/jpeg")).toBe(true);
        expect(isSupportedImageFile("notes.txt", "text/plain")).toBe(false);
        expect(isSupportedImageFile("archive.zip", "")).toBe(false);
    });

    it("normalizeDepthMap & generateDepthOcclusionMaskPixels: generates foreground occlusion alpha only for pixels closer than threshold", () => {
        const raw = [10, 50, 90, 100];
        const norm = normalizeDepthMap(raw, 2, 2);
        expect(norm[0]).toBeCloseTo(0, 4);
        expect(norm[3]).toBeCloseTo(1, 4);

        const mask = generateDepthOcclusionMaskPixels(norm, 2, 2, 0.5, 0.02);
        // ピクセル0 (depth=0.0, 奥) は透明
        expect(mask[3]).toBe(0);
        // ピクセル3 (depth=1.0, 手前) は不透明 (255)
        expect(mask[3 * 4 + 3]).toBe(255);
    });

    it("generateDepthOcclusionMaskPixels: preserves thin fence ridges & bridges 1px gaps with guide refinement", () => {
        // 7x7 深度マップ: 背景0.30、中央列(x=3)に細い柵(0.54)、y=3だけ0.48に抜けた状態
        const depth = new Float32Array(7 * 7).fill(0.3);
        for (let y = 0; y < 7; y++) {
            depth[y * 7 + 3] = y === 3 ? 0.48 : 0.54;
        }
        // threshold=0.55 だと通常は全透明だが、preserveThinStructures=true で局所ピーク強調＋1pxギャップ補完が効く
        const plainMask = generateDepthOcclusionMaskPixels(depth, 7, 7, 0.55, 0.01);
        expect(plainMask[(2 * 7 + 3) * 4 + 3]).toBe(0);

        const fenceMask = generateDepthOcclusionMaskPixels(depth, 7, 7, 0.55, 0.01, {
            preserveThinStructures: true,
        });
        expect(fenceMask[(2 * 7 + 3) * 4 + 3]).toBeGreaterThan(128);
        // y=3 の1px途切れも上下からブリッジ補完される
        expect(fenceMask[(3 * 7 + 3) * 4 + 3]).toBeGreaterThan(128);

        // ガイドRGBA付きアップサンプリング(14x14)で正しいサイズが出力されること
        const guide = new Uint8ClampedArray(14 * 14 * 4).fill(200);
        for (let gy = 0; gy < 14; gy++) {
            for (let gx = 6; gx <= 7; gx++) {
                const p = (gy * 14 + gx) * 4;
                guide[p] = 40;
                guide[p + 1] = 40;
                guide[p + 2] = 40;
                guide[p + 3] = 255;
            }
        }
        const guidedMask = generateDepthOcclusionMaskPixels(depth, 7, 7, 0.55, 0.01, {
            preserveThinStructures: true,
            guideRgba: guide,
            guideWidth: 14,
            guideHeight: 14,
        });
        expect(guidedMask.length).toBe(14 * 14 * 4);
        // 柵の色(40)を持つ中央はマスクされ、背景色(200)の端(gx=0)は透明のまま
        expect(guidedMask[(7 * 14 + 6) * 4 + 3]).toBeGreaterThan(128);
        expect(guidedMask[(7 * 14 + 0) * 4 + 3]).toBe(0);
    });

    it("estimateCharacterGroundDepth: ignores foreground fence outliers near character feet", () => {
        const depth = new Float32Array(20 * 20).fill(0.4);
        // 足元中心付近に手前の柵(0.85)がかぶっている状態
        for (let y = 14; y <= 17; y++) {
            depth[y * 20 + 10] = 0.85;
            depth[y * 20 + 11] = 0.85;
        }
        const ground = estimateCharacterGroundDepth(depth, 20, 20, 0.5, 0.78);
        expect(ground).toBeCloseTo(0.4, 2);
    });

    it("estimateDistanceFromArDepth: estimates nearer distance for foreground floor and farther distance for background floor", () => {
        const depth = new Float32Array(20 * 20);
        for (let y = 0; y < 20; y++) {
            const rowDepth = y < 10 ? 0.15 : 0.78;
            for (let x = 0; x < 20; x++) {
                depth[y * 20 + x] = rowDepth;
            }
        }
        const nearDist = estimateDistanceFromArDepth({
            normalizedDepth: depth,
            width: 20,
            height: 20,
            footXRatio: 0.5,
            footYRatio: 0.85,
            verticalFovDeg: 74,
        });
        const farDist = estimateDistanceFromArDepth({
            normalizedDepth: depth,
            width: 20,
            height: 20,
            footXRatio: 0.5,
            footYRatio: 0.45,
            verticalFovDeg: 74,
        });
        expect(nearDist).toBeGreaterThanOrEqual(0.5);
        expect(nearDist).toBeLessThan(farDist);
    });

    it("calculateScaleForCharacterHeight: calculates realistic scale from height(cm), distance(m), and alpha ratio", () => {
        const sClose = calculateScaleForCharacterHeight({
            characterHeightCm: 160,
            distanceMeters: 2.0,
            opaqueHeightRatio: 1.0,
        });
        const sFar = calculateScaleForCharacterHeight({
            characterHeightCm: 160,
            distanceMeters: 4.0,
            opaqueHeightRatio: 1.0,
        });
        expect(sClose).toBeGreaterThan(sFar);
        expect(sClose).toBeCloseTo(sFar * 2, 1);

        // 160cm・2.5m・portrait 74° で高解像度立ち絵(縮小解析後も opaqueHeightRatio=0.9)でも巨大化(4.0張り付き)しないこと
        const normalScale = calculateScaleForCharacterHeight({
            characterHeightCm: 160,
            distanceMeters: 2.5,
            opaqueHeightRatio: 0.9,
            verticalFovDeg: 74,
        });
        expect(normalScale).toBeGreaterThan(0.5);
        expect(normalScale).toBeLessThan(1.0);

        // 透過余白が多い画像（不透明領域50%）ではより大きいscaleになること
        const sPadded = calculateScaleForCharacterHeight({
            characterHeightCm: 160,
            distanceMeters: 4.0,
            opaqueHeightRatio: 0.5,
        });
        expect(sPadded).toBeCloseTo(sFar * 2, 1);

        // NaNフォールバック・クランプ確認
        const sInvalid = calculateScaleForCharacterHeight({
            characterHeightCm: NaN,
            distanceMeters: Infinity,
        });
        expect(Number.isFinite(sInvalid)).toBe(true);
        expect(sInvalid).toBeGreaterThanOrEqual(0.1);
        expect(sInvalid).toBeLessThanOrEqual(4.0);

        // 縦持ちスマホ広角(74°)・身長160cm・距離2.0mで画面占有率が約50〜55%(scale 0.8〜0.95)に収まること
        const sPortrait2m = calculateScaleForCharacterHeight({
            characterHeightCm: 160,
            distanceMeters: 2.0,
            opaqueHeightRatio: 1.0,
            verticalFovDeg: 74,
        });
        expect(sPortrait2m).toBeGreaterThanOrEqual(0.75);
        expect(sPortrait2m).toBeLessThanOrEqual(0.95);
    });

    it("estimateGroundTiltFromDepthMap: estimates steeper tilt for stronger foreground-to-midground gradient", () => {
        const w = 10;
        const h = 20;
        const flat = new Float32Array(w * h).fill(0.5);
        const steep = new Float32Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                steep[y * w + x] = y / (h - 1);
            }
        }
        expect(estimateGroundTiltFromDepthMap(steep, w, h)).toBeGreaterThan(
            estimateGroundTiltFromDepthMap(flat, w, h),
        );
    });

    it("generateGroundShadowMaskPixels: preserves shadow near foot depth and suppresses distant background", () => {
        // 4x4: 上2行(奥) = 0.05、下2行(足元の床) = 0.75
        const depth = new Float32Array([
            0.05, 0.05, 0.05, 0.05,
            0.05, 0.05, 0.05, 0.05,
            0.75, 0.75, 0.75, 0.75,
            0.75, 0.75, 0.75, 0.75,
        ]);
        const mask = generateGroundShadowMaskPixels(depth, 4, 4, 0.5, 0.9, 0.2);
        expect(mask[3]).toBe(0); // 上段(空/遠景壁)は影を消す
        expect(mask[15 * 4 + 3]).toBe(255); // 下段(足元平面)は影を残す
    });

    it("estimateBackgroundOpticalShift: detects horizontal/vertical camera translation on textured background", () => {
        const w = 32;
        const h = 24;
        const prev = new Uint8Array(w * h);
        const curr = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                prev[y * w + x] = ((x * 29 + y * 17) % 200) + 20;
            }
        }
        // 背景が右へ3px、下へ2px移動したフレームを作成
        for (let y = 2; y < h; y++) {
            for (let x = 3; x < w; x++) {
                curr[y * w + x] = prev[(y - 2) * w + (x - 3)];
            }
        }
        const shift = estimateBackgroundOpticalShift(prev, curr, w, h, 6);
        expect(shift.dx).toBe(3);
        expect(shift.dy).toBe(2);
    });

    it("estimateBackgroundScaleAndShift: detects camera approach (zoom in > 1.0) and retreat (zoom out < 1.0)", () => {
        const w = 48;
        const h = 48;
        const cx = (w - 1) * 0.5;
        const cy = (h - 1) * 0.5;
        const prev = new Uint8Array(w * h);
        const currApproach = new Uint8Array(w * h);
        const currRetreat = new Uint8Array(w * h);

        const pattern = (x: number, y: number) =>
            Math.round(128 + 80 * Math.sin(x * 0.35) * Math.cos(y * 0.35));

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                prev[y * w + x] = pattern(x - cx, y - cy);
                currApproach[y * w + x] = pattern((x - cx) / 1.25, (y - cy) / 1.25);
                currRetreat[y * w + x] = pattern((x - cx) / 0.8, (y - cy) / 0.8);
            }
        }

        const resApproach = estimateBackgroundScaleAndShift(prev, currApproach, w, h, 4);
        expect(resApproach.scale).toBeGreaterThan(1.12);
        expect(resApproach.confidence).toBeGreaterThan(0.18);

        const resRetreat = estimateBackgroundScaleAndShift(prev, currRetreat, w, h, 4);
        expect(resRetreat.scale).toBeLessThan(0.92);
        expect(resRetreat.confidence).toBeGreaterThan(0.18);

        // スマホ高さ変化による大きい上下移動(dy=-11px)でもアンカー重み付け＋広域探索で追従できること
        const hTall = 64;
        const prevTall = new Uint8Array(w * hTall);
        const currRaised = new Uint8Array(w * hTall);
        const nonPeriodic = (x: number, y: number) =>
            Math.round(
                128 +
                    50 * Math.sin(x * 0.31) * Math.cos(y * 0.29) +
                    45 * Math.cos(x * 0.13 + y * 0.11),
            );
        for (let y = 0; y < hTall; y++) {
            for (let x = 0; x < w; x++) {
                prevTall[y * w + x] = nonPeriodic(x, y);
                // 画面全体が -11px 上へシフト（カメラを下げた状態）
                currRaised[y * w + x] = nonPeriodic(x, y + 11);
            }
        }
        const resHeightShift = estimateBackgroundScaleAndShift(prevTall, currRaised, w, hTall, 18, 0.5, 0.78);
        expect(resHeightShift.dy).toBeLessThanOrEqual(-9);
        expect(resHeightShift.confidence).toBeGreaterThan(0.18);
    });

    it("sampleDepthAtNormalizedPoint: averages 3x3 region around normalized coordinates", () => {
        const depth = new Float32Array([
            0.1, 0.1, 0.1, 0.1,
            0.1, 0.1, 0.1, 0.1,
            0.8, 0.8, 0.8, 0.8,
            0.8, 0.8, 0.8, 0.8,
        ]);
        expect(sampleDepthAtNormalizedPoint(depth, 4, 4, 0.5, 0.9)).toBeCloseTo(0.8, 4);
        expect(sampleDepthAtNormalizedPoint(depth, 4, 4, 0.5, 0.1)).toBeCloseTo(0.1, 4);
    });

    it("calculateCharacterColorAdaptation: adapts tint color, brightness, saturate, and rim direction to background lighting", () => {
        const warmDark = calculateCharacterColorAdaptation(
            {
                luminance: 0.25,
                ambientColor: { r: 220, g: 130, b: 60 },
                suggestedAzimuthDeg: 90,
                suggestedShadowOpacity: 0.3,
                brightnessMultiplier: 0.78,
            },
            90,
        );
        const coolBright = calculateCharacterColorAdaptation(
            {
                luminance: 0.85,
                ambientColor: { r: 170, g: 205, b: 245 },
                suggestedAzimuthDeg: 270,
                suggestedShadowOpacity: 0.55,
                brightnessMultiplier: 1.1,
            },
            270,
        );

        expect(warmDark.tintRgb.r).toBeGreaterThan(warmDark.tintRgb.b);
        expect(coolBright.tintRgb.b).toBeGreaterThan(coolBright.tintRgb.r);
        expect(warmDark.saturate).toBeLessThan(coolBright.saturate);
        expect(warmDark.tintAlpha).toBeGreaterThan(coolBright.tintAlpha);
        expect(warmDark.rimDirX).toBeCloseTo(1, 3);
        expect(coolBright.rimDirX).toBeCloseTo(-1, 3);
    });

    it("analyzeGroundAndWallPlanes & generateSurfaceOverlayPixels: separates vertical walls from receding horizontal ground", () => {
        const w = 24;
        const h = 24;
        const depth = new Float32Array(w * h);
        for (let y = 0; y < h; y++) {
            // 上半分(y < 12)は奥行き一定の正面壁(0.35)、下半分(y >= 12)は手前に迫る床(0.35 -> 0.90)
            const val = y < 12 ? 0.35 : 0.35 + ((y - 11) / 12) * 0.55;
            for (let x = 0; x < w; x++) {
                depth[y * w + x] = val;
            }
        }
        const surface = analyzeGroundAndWallPlanes(depth, w, h);
        expect(surface.groundRatio).toBeGreaterThan(0.25);
        expect(surface.wallRatio).toBeGreaterThan(0.25);
        expect(surface.horizonYRatio).toBeGreaterThanOrEqual(0.35);
        expect(surface.horizonYRatio).toBeLessThanOrEqual(0.65);

        const overlay = generateSurfaceOverlayPixels(surface.labels, w, h);
        expect(overlay.length).toBe(w * h * 4);
        // 壁領域 (y=4, x=4) はインディゴ系 alpha > 0
        expect(overlay[(4 * w + 4) * 4 + 3]).toBeGreaterThan(0);
        // 地面領域 (y=18, x=4) はエメラルド系 alpha > 0
        expect(overlay[(18 * w + 4) * 4 + 3]).toBeGreaterThan(0);
    });

    it("calculateApertureMaxBlurPx & generateDofOutOfFocusMaskPixels: blurs out-of-focus regions based on aperture F-stop", () => {
        const wideBlur = calculateApertureMaxBlurPx(1.4, 2.0);
        const narrowBlur = calculateApertureMaxBlurPx(8.0, 2.0);
        expect(wideBlur).toBeGreaterThan(narrowBlur);
        expect(wideBlur).toBeGreaterThan(10);
        expect(narrowBlur).toBeLessThan(5);

        const depth = new Float32Array([
            0.1, 0.55, 0.9,
            0.2, 0.55, 0.85,
        ]);
        const wideMask = generateDofOutOfFocusMaskPixels(depth, 3, 2, 0.55, 1.4);
        // ピント位置(0.55)は alpha = 0 (ボケない)
        expect(wideMask[1 * 4 + 3]).toBe(0);
        expect(wideMask[4 * 4 + 3]).toBe(0);
        // ピントから外れた奥(0.1)と手前(0.9)は alpha > 0 (ボケる)
        expect(wideMask[0 * 4 + 3]).toBeGreaterThan(200);
        expect(wideMask[2 * 4 + 3]).toBeGreaterThan(200);
    });
});
