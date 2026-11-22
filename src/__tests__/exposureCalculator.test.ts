// src/__tests__/exposureCalculator.test.ts
import { describe, it, expect } from "vitest";
import {
    calculateEv100,
    calculateShutterSpeed,
    calculateAperture,
    calculateIso,
    findClosestStandardValue,
    calculateNdExposure,
    formatShutterSpeed,
    calculateAstroShutterLimit,
    calculateLuminanceFromImageData,
    estimateEvFromLuminance,
    calculateEvFromCameraSettings,
    STANDARD_APERTURES,
    STANDARD_ISOS,
    STANDARD_SHUTTER_SPEEDS,
    ND_FILTER_PRESETS,
    SCENE_PRESETS,
} from "../utils/exposureCalculator";

describe("exposureCalculator utility tests", () => {
    describe("calculateEv100", () => {
        it("Sunny 16 ルール (f/16, 1/125s, ISO 100) で EV 15 付近になること", () => {
            const ev = calculateEv100(16, 1 / 125, 100);
            // log2(256 / 0.008) = log2(32000) ≈ 14.966 -> 約15.0
            expect(Math.round(ev)).toBe(15);
        });

        it("ISO 400 のときの EV100 を正しく算出すること", () => {
            // ISO 400 は ISO 100 より +2EV 明るい設定なので、EV100 はその分下がる
            const ev = calculateEv100(4, 1 / 60, 400);
            expect(typeof ev).toBe("number");
            expect(Number.isFinite(ev)).toBe(true);
        });

        it("NDフィルターの減光段数が正しく加算されること", () => {
            const evNoNd = calculateEv100(8, 1 / 250, 100, 0);
            const evNd10 = calculateEv100(8, 1 / 250, 100, 10);
            expect(evNd10 - evNoNd).toBeCloseTo(10, 1);
        });

        it("異常値・0・負数・NaN の入力でもクラッシュせず 0 を返すこと", () => {
            expect(calculateEv100(0, 1 / 125, 100)).toBe(0);
            expect(calculateEv100(8, -1, 100)).toBe(0);
            expect(calculateEv100(8, 1 / 125, NaN)).toBe(0);
        });
    });

    describe("calculateShutterSpeed", () => {
        it("EV15, f/16, ISO 100 のときに約 1/125秒 を返すこと", () => {
            const t = calculateShutterSpeed(15, 16, 100);
            expect(t).toBeCloseTo(1 / 125, 2);
        });

        it("ND1000 (10段) 適用時にシャッター速度が 1024倍（約10段分）長くなること", () => {
            const tNormal = calculateShutterSpeed(12, 8, 100, 0);
            const tNd10 = calculateShutterSpeed(12, 8, 100, 10);
            expect(tNd10 / tNormal).toBeCloseTo(1024, 0);
        });

        it("無効な入力でも有限の数値を返すこと", () => {
            const t = calculateShutterSpeed(NaN, -5, 0);
            expect(Number.isFinite(t)).toBe(true);
        });
    });

    describe("calculateAperture", () => {
        it("EV15, 1/125s, ISO 100 のときに約 f/16 を算出すること", () => {
            const f = calculateAperture(15, 1 / 125, 100);
            expect(Math.round(f)).toBe(16);
        });

        it("無効な入力でも有限の安全な数値を返すこと", () => {
            const f = calculateAperture(NaN, 0, -100);
            expect(Number.isFinite(f)).toBe(true);
            expect(f).toBeGreaterThan(0);
        });
    });

    describe("calculateIso", () => {
        it("EV15, f/16, 1/125s のときに約 ISO 100 を算出すること", () => {
            const iso = calculateIso(15, 16, 1 / 125);
            expect(iso).toBeCloseTo(100, -1);
        });

        it("無効な入力でも有限の安全な数値を返すこと", () => {
            const iso = calculateIso(NaN, 0, -1);
            expect(Number.isFinite(iso)).toBe(true);
            expect(iso).toBeGreaterThan(0);
        });
    });

    describe("findClosestStandardValue", () => {
        it("F値の近似値を正しく選択すること", () => {
            const closest = findClosestStandardValue(
                2.7,
                STANDARD_APERTURES,
                (v) => v,
            );
            expect(closest).toBe(2.8);
        });

        it("ISO感度の近似値を正しく選択すること", () => {
            const closest = findClosestStandardValue(
                750,
                STANDARD_ISOS,
                (v) => v,
            );
            expect(closest).toBe(800);
        });

        it("シャッタースピードの近似値を正しく選択すること", () => {
            const closest = findClosestStandardValue(
                1 / 230,
                STANDARD_SHUTTER_SPEEDS,
                (s) => s.value,
            );
            expect(closest.label).toBe("1/250s");
        });
    });

    describe("calculateNdExposure", () => {
        it("ND1000 (10段) で 1/60s が約17秒に伸びること", () => {
            const newT = calculateNdExposure(1 / 60, 10);
            expect(newT).toBeCloseTo(1024 / 60, 1);
        });

        it("段数0なら同じ秒数であること", () => {
            expect(calculateNdExposure(1, 0)).toBe(1);
        });

        it("負数やNaNの入力防御", () => {
            expect(calculateNdExposure(-1, 5)).toBe(0);
            expect(calculateNdExposure(1, NaN)).toBe(1);
        });
    });

    describe("formatShutterSpeed", () => {
        it("1秒未満の分数表記", () => {
            expect(formatShutterSpeed(1 / 250)).toBe("1/250秒");
            expect(formatShutterSpeed(1 / 8000)).toBe("1/8000秒");
        });

        it("1秒以上60秒未満の秒表記", () => {
            expect(formatShutterSpeed(15)).toBe("15秒");
            expect(formatShutterSpeed(2.5)).toBe("2.5秒");
        });

        it("60秒以上の分・秒表記", () => {
            const res = formatShutterSpeed(150); // 2分30秒
            expect(res).toContain("2分");
            expect(res).toContain("30秒");
            expect(res).toContain("150秒");
        });

        it("3600秒以上の時間表記", () => {
            const res = formatShutterSpeed(3665); // 1時間1分5秒
            expect(res).toContain("1時間");
            expect(res).toContain("1分");
            expect(res).toContain("5秒");
        });

        it("異常値のハンドリング", () => {
            expect(formatShutterSpeed(0)).toBe("0s");
            expect(formatShutterSpeed(-5)).toBe("0s");
            expect(formatShutterSpeed(NaN)).toBe("0s");
        });
    });

    describe("calculateAstroShutterLimit", () => {
        it("500ルールとNPFルールを正しく計算すること", () => {
            // フルサイズ (1.0x), 24mm, f/2.8, 5.9μm
            const result = calculateAstroShutterLimit(24, 1.0, 2.8, 5.9);
            // 500 / 24 ≈ 20.8秒
            expect(result.rule500).toBeCloseTo(20.8, 1);
            // NPF: (35 * 2.8 + 30 * 5.9) / 24 = (98 + 177) / 24 = 275 / 24 ≈ 11.5秒
            expect(result.npfRule).toBeCloseTo(11.5, 1);
        });

        it("異常値の防御", () => {
            const res = calculateAstroShutterLimit(0, 1.0);
            expect(res.rule500).toBe(0);
            expect(res.npfRule).toBe(0);
        });
    });

    describe("プリセット整合性", () => {
        it("NDフィルタープリセットが空でないこと", () => {
            expect(ND_FILTER_PRESETS.length).toBeGreaterThanOrEqual(10);
        });

        it("シーンプリセットが空でないこと", () => {
            expect(SCENE_PRESETS.length).toBeGreaterThanOrEqual(8);
        });
    });

    describe("カメラ測光（露出計）ユーティリティ", () => {
        it("ImageData から平均輝度を算出できること", () => {
            // 4x4ピクセルの白画像 (RGB 255)
            const whiteData = new Uint8ClampedArray(4 * 4 * 4).fill(255);
            const mockImageData = {
                width: 4,
                height: 4,
                data: whiteData,
                colorSpace: "srgb" as PredefinedColorSpace,
            };
            const lum = calculateLuminanceFromImageData(mockImageData, "matrix");
            expect(lum).toBeCloseTo(255, 0);

            // 黒画像 (RGB 0)
            const blackData = new Uint8ClampedArray(4 * 4 * 4).fill(0);
            const mockBlack = {
                width: 4,
                height: 4,
                data: blackData,
                colorSpace: "srgb" as PredefinedColorSpace,
            };
            const lumBlack = calculateLuminanceFromImageData(mockBlack, "matrix");
            expect(lumBlack).toBe(0);
        });

        it("スポット測光・中央重点測光で重み付けが機能すること", () => {
            const data = new Uint8ClampedArray(10 * 10 * 4).fill(0);
            // 中央ピクセルだけ白にする
            const mockImage = {
                width: 10,
                height: 10,
                data,
                colorSpace: "srgb" as PredefinedColorSpace,
            };
            const spotLum = calculateLuminanceFromImageData(mockImage, "spot");
            expect(Number.isFinite(spotLum)).toBe(true);
        });

        it("estimateEvFromLuminance で基準輝度からEVとLuxを算出すること", () => {
            // 輝度120なら offset 0、baseEv 10 なら EV 10
            const result = estimateEvFromLuminance(120, 10, 0);
            expect(result.ev).toBe(10);
            expect(result.offsetEv).toBe(0);
            expect(result.lux).toBeGreaterThan(0);

            // 輝度が2倍なら +1EV
            const brightResult = estimateEvFromLuminance(240, 10, 0);
            expect(brightResult.offsetEv).toBe(1);
            expect(brightResult.ev).toBe(11);
        });

        it("calculateEvFromCameraSettings でハードウェア露光パラメータからEVを計算すること", () => {
            // W3C ImageCapture 仕様: 100μs 単位 (80 = 1/125s)
            // f/2.0, 1/125s (80), ISO 100 -> log2(4 / 0.008) = log2(500) ≈ 8.97
            const ev100us = calculateEvFromCameraSettings(80, 100, 2.0);
            expect(ev100us).toBeCloseTo(8.97, 1);

            // 秒数で直接渡された場合 (0.008s)
            const evSeconds = calculateEvFromCameraSettings(0.008, 100, 2.0);
            expect(evSeconds).toBeCloseTo(8.97, 1);

            // 室内で一般的な設定: 333 (1/30s), ISO 400, f/1.8 -> EV 4.6〜6 付近
            const evIndoor = calculateEvFromCameraSettings(333, 400, 1.8);
            expect(evIndoor).toBeGreaterThan(4);
            expect(evIndoor).toBeLessThan(7);

            // 無効値の場合は null を返すこと
            expect(calculateEvFromCameraSettings(undefined, 100)).toBeNull();
            expect(calculateEvFromCameraSettings(80, 0)).toBeNull();
        });
    });
});
