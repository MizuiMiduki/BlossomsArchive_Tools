import { describe, it, expect } from "vitest";
import {
    clampFinite,
    normalizeAngleDeg,
    shortestAngleDeltaDeg,
    analyzeImageAlphaBounds,
    estimateEnvironmentLighting,
    calculateProjectedShadowTransform,
    calculateGyroParallaxOffset,
    createShadowSilhouettePixels,
    isSupportedImageFile,
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
});
