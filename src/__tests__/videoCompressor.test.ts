import { describe, it, expect } from "vitest";
import {
    calculateReductionPercent,
    calculateTargetDimensions,
    estimateCompressedSize,
    formatBytes,
    formatDuration,
    getSupportedVideoCodecs,
} from "../utils/videoCompressor";

describe("videoCompressor utilities", () => {
    describe("formatBytes", () => {
        it("0バイト以下の場合は 0 B を返すこと", () => {
            expect(formatBytes(0)).toBe("0 B");
            expect(formatBytes(-100)).toBe("0 B");
        });

        it("正しく単位換算できること", () => {
            expect(formatBytes(500)).toBe("500.0 B");
            expect(formatBytes(1024)).toBe("1.0 KB");
            expect(formatBytes(1048576)).toBe("1.0 MB");
            expect(formatBytes(1073741824)).toBe("1.0 GB");
            expect(formatBytes(1572864, 2)).toBe("1.50 MB");
        });
    });

    describe("formatDuration", () => {
        it("無効な値や0の場合は 00:00 を返すこと", () => {
            expect(formatDuration(0)).toBe("00:00");
            expect(formatDuration(-5)).toBe("00:00");
            expect(formatDuration(NaN)).toBe("00:00");
        });

        it("1時間未満の秒数を MM:SS にフォーマットすること", () => {
            expect(formatDuration(9)).toBe("00:09");
            expect(formatDuration(65)).toBe("01:05");
            expect(formatDuration(599)).toBe("09:59");
        });

        it("1時間以上の秒数を HH:MM:SS にフォーマットすること", () => {
            expect(formatDuration(3600)).toBe("01:00:00");
            expect(formatDuration(3665)).toBe("01:01:05");
            expect(formatDuration(7325)).toBe("02:02:05");
        });
    });

    describe("calculateTargetDimensions", () => {
        it("無効な解像度の場合は {0, 0} を返すこと", () => {
            expect(calculateTargetDimensions(0, 0, 75)).toEqual({ width: 0, height: 0 });
            expect(calculateTargetDimensions(-100, 100, 75)).toEqual({ width: 0, height: 0 });
        });

        it("偶数に丸められること", () => {
            // 1920 * 0.75 = 1440, 1080 * 0.75 = 810
            const res = calculateTargetDimensions(1920, 1080, 75);
            expect(res.width % 2).toBe(0);
            expect(res.height % 2).toBe(0);
            expect(res.width).toBe(1440);
            expect(res.height).toBe(810);
        });

        it("maxDimension制限が正しく適用されること", () => {
            // 1920x1080を100%でmaxDimension=1280にした場合、幅1280、高さ720
            const res = calculateTargetDimensions(1920, 1080, 100, 1280);
            expect(res.width).toBe(1280);
            expect(res.height).toBe(720);
        });

        it("奇数解像度も偶数に調整されること", () => {
            const res = calculateTargetDimensions(1921, 1081, 100);
            expect(res.width % 2).toBe(0);
            expect(res.height % 2).toBe(0);
            expect(res.width).toBe(1920);
            expect(res.height).toBe(1080);
        });
    });

    describe("estimateCompressedSize", () => {
        it("再生時間やビットレートが0以下の場合は0を返すこと", () => {
            expect(estimateCompressedSize(0, 1000)).toBe(0);
            expect(estimateCompressedSize(10, 0)).toBe(0);
        });

        it("音声あり・なしで正しく見積もりサイズを計算できること", () => {
            // 10秒, 映像1000 kbps, 音声128 kbps = 1128 kbps
            // 1128 * 1000 * 10 / 8 = 1,410,000 bytes
            const withAudio = estimateCompressedSize(10, 1000, 128, true);
            expect(withAudio).toBe(1410000);

            // 音声なし: 1000 * 1000 * 10 / 8 = 1,250,000 bytes
            const withoutAudio = estimateCompressedSize(10, 1000, 128, false);
            expect(withoutAudio).toBe(1250000);
            expect(withAudio).toBeGreaterThan(withoutAudio);
        });
    });

    describe("calculateReductionPercent", () => {
        it("正常な削減率（%）が計算されること", () => {
            // 100MB -> 25MB = 75% 削減
            expect(calculateReductionPercent(100, 25)).toBe(75);
            // 100MB -> 50.5MB = 49.5% 削減
            expect(calculateReductionPercent(100, 50.5)).toBe(49.5);
        });

        it("サイズが0以下の場合は0を返すこと", () => {
            expect(calculateReductionPercent(0, 50)).toBe(0);
            expect(calculateReductionPercent(100, 0)).toBe(0);
        });
    });

    describe("getSupportedVideoCodecs", () => {
        it("フォールバックまたはコーデック配列を返すこと", () => {
            const codecs = getSupportedVideoCodecs();
            expect(Array.isArray(codecs)).toBe(true);
            expect(codecs.length).toBeGreaterThan(0);
            expect(codecs[0]).toHaveProperty("mimeType");
            expect(codecs[0]).toHaveProperty("extension");
        });
    });
});
