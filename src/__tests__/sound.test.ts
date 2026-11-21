import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initAudio, closeAudio, playNotificationSound, playClockTickSound } from "../utils/sound";

describe("sound utility", () => {
    let mockOscillator: any;
    let mockGain: any;
    let mockAudioCtx: any;

    beforeEach(() => {
        mockOscillator = {
            type: "sine",
            frequency: {
                setValueAtTime: vi.fn(),
                exponentialRampToValueAtTime: vi.fn(),
            },
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
        };

        mockGain = {
            gain: {
                setValueAtTime: vi.fn(),
                linearRampToValueAtTime: vi.fn(),
                exponentialRampToValueAtTime: vi.fn(),
            },
            connect: vi.fn(),
        };

        mockAudioCtx = {
            state: "suspended",
            currentTime: 10,
            destination: {},
            createOscillator: vi.fn().mockReturnValue(mockOscillator),
            createGain: vi.fn().mockReturnValue(mockGain),
            resume: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
        };

        (window as any).AudioContext = class MockAudioContext {
            constructor() {
                return mockAudioCtx;
            }
        };
    });

    afterEach(() => {
        closeAudio();
        vi.restoreAllMocks();
    });

    it("initAudioでAudioContextが初期化されsuspendedならresumeされること", () => {
        const ctx = initAudio();
        expect(ctx).toBe(mockAudioCtx);
        expect(mockAudioCtx.resume).toHaveBeenCalled();
    });

    it("closeAudioでAudioContextが閉じられること", () => {
        initAudio();
        closeAudio();
        expect(mockAudioCtx.close).toHaveBeenCalled();
    });

    it("playNotificationSound (alarm) でオシレーターとゲインが適切に設定されること", () => {
        playNotificationSound({ soundType: "alarm", volume: 0.5 });
        expect(mockAudioCtx.createGain).toHaveBeenCalled();
        expect(mockAudioCtx.createOscillator).toHaveBeenCalled();
        expect(mockOscillator.start).toHaveBeenCalled();
        expect(mockOscillator.stop).toHaveBeenCalled();
    });

    it("playNotificationSound (chime) でオシレーターとゲインが適切に設定されること", () => {
        playNotificationSound({ soundType: "chime", volume: 0.8 });
        expect(mockAudioCtx.createGain).toHaveBeenCalled();
        expect(mockAudioCtx.createOscillator).toHaveBeenCalled();
        expect(mockOscillator.start).toHaveBeenCalled();
    });

    it("音量が0または無効値の場合の安全な挙動", () => {
        playNotificationSound({ volume: 0 });
        // 音量0の場合は再生処理を行わない
        expect(mockAudioCtx.createOscillator).not.toHaveBeenCalled();

        // NaNやInfinityでもクラッシュしないこと
        expect(() => {
            playNotificationSound({ volume: NaN });
            playNotificationSound({ volume: Infinity });
        }).not.toThrow();
    });

    it("playClockTickSound (Tick / Tock) でオシレーターとゲインが適切に設定されること", () => {
        // Tick (奇数秒相当)
        playClockTickSound(false, 0.7);
        expect(mockAudioCtx.createGain).toHaveBeenCalled();
        expect(mockAudioCtx.createOscillator).toHaveBeenCalled();
        expect(mockOscillator.start).toHaveBeenCalled();
        expect(mockOscillator.stop).toHaveBeenCalled();

        mockAudioCtx.createOscillator.mockClear();

        // Tock (偶数秒相当)
        playClockTickSound(true, 0.7);
        expect(mockAudioCtx.createOscillator).toHaveBeenCalled();

        // volume 0 の時は再生されないこと
        mockAudioCtx.createOscillator.mockClear();
        playClockTickSound(false, 0);
        expect(mockAudioCtx.createOscillator).not.toHaveBeenCalled();
    });
});
