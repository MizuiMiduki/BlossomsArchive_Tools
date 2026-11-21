// src/utils/sound.ts

type SoundType = "alarm" | "chime";

export interface PlaySoundOptions {
    soundType?: SoundType;
    volume?: number; // 0.0 - 1.0
    pitchModifier?: number; // 0.5 - 2.0
}

let sharedAudioCtx: AudioContext | null = null;

/**
 * ユーザー操作時（スタートボタン押下等）に呼び出し、AudioContextを安全に初期化・resumeします。
 * ブラウザのAutoplay Policyに対応します。
 */
export function initAudio(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
    if (!AudioCtxClass) return null;

    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
        try {
            sharedAudioCtx = new AudioCtxClass();
        } catch {
            return null;
        }
    }

    if (sharedAudioCtx.state === "suspended") {
        sharedAudioCtx.resume().catch(() => {});
    }

    return sharedAudioCtx;
}

/**
 * AudioContextを停止・解放します（ページ離脱時等）。
 */
export function closeAudio(): void {
    if (sharedAudioCtx && sharedAudioCtx.state !== "closed") {
        try {
            sharedAudioCtx.close().catch(() => {});
        } finally {
            sharedAudioCtx = null;
        }
    }
}

/**
 * Web Audio API を用いて電子音・チャイムを合成・再生します。
 * 外部音源ファイル不使用のため、ライセンス表記・著作権表記は完全に不要です。
 */
export function playNotificationSound(options: PlaySoundOptions = {}): void {
    if (typeof window === "undefined") return;

    const ctx = initAudio();
    if (!ctx) return;

    const rawVolume = typeof options.volume === "number" ? options.volume : 1.0;
    const volume = Number.isFinite(rawVolume)
        ? Math.max(0, Math.min(1, rawVolume))
        : 1.0;

    if (volume <= 0) return;

    const soundType = options.soundType || "alarm";
    const rawPitch =
        typeof options.pitchModifier === "number" ? options.pitchModifier : 1.0;
    const pitch = Number.isFinite(rawPitch)
        ? Math.max(0.2, Math.min(3.0, rawPitch))
        : 1.0;

    const currentTime = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, currentTime);
    masterGain.connect(ctx.destination);

    if (soundType === "alarm") {
        // 電子アラーム音: 「ピピピッ、ピピピッ、ピピピッ」 (明瞭で聞き取りやすい高音圧パルス3セット)
        const baseFreq = 1046.5 * pitch; // C6 (デジタルアラームで最も通りやすい帯域)
        const beeps = [
            // 1セット目
            { start: 0.0, end: 0.09, freq: baseFreq },
            { start: 0.13, end: 0.22, freq: baseFreq },
            { start: 0.26, end: 0.35, freq: baseFreq },
            // 2セット目
            { start: 0.55, end: 0.64, freq: baseFreq },
            { start: 0.68, end: 0.77, freq: baseFreq },
            { start: 0.81, end: 0.9, freq: baseFreq },
            // 3セット目
            { start: 1.1, end: 1.19, freq: baseFreq },
            { start: 1.23, end: 1.32, freq: baseFreq },
            { start: 1.36, end: 1.48, freq: baseFreq },
        ];

        beeps.forEach(({ start, end, freq }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "square";
            osc.frequency.setValueAtTime(freq, currentTime + start);

            // クリックノイズ防止のための微小フェードイン・アウト（高ゲイン 0.9 でしっかり大きく鳴らす）
            gain.gain.setValueAtTime(0, currentTime + start);
            gain.gain.linearRampToValueAtTime(0.9, currentTime + start + 0.008);
            gain.gain.setValueAtTime(0.9, currentTime + end - 0.008);
            gain.gain.linearRampToValueAtTime(0, currentTime + end);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(currentTime + start);
            osc.stop(currentTime + end);
        });
    } else {
        // チャイム音: 「ポーン」 (倍音を含んだ明るく大きなチャイム減衰音)
        const notes = [
            { start: 0.0, duration: 1.1, freq: 523.25 * pitch, peak: 0.7 }, // C5
            { start: 0.15, duration: 1.3, freq: 659.25 * pitch, peak: 0.7 }, // E5
            { start: 0.3, duration: 1.6, freq: 783.99 * pitch, peak: 0.75 }, // G5
            { start: 0.45, duration: 1.8, freq: 1046.5 * pitch, peak: 0.8 }, // C6
        ];

        notes.forEach(({ start, duration, freq, peak }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, currentTime + start);

            gain.gain.setValueAtTime(0, currentTime + start);
            gain.gain.linearRampToValueAtTime(peak, currentTime + start + 0.015);
            gain.gain.exponentialRampToValueAtTime(
                0.001,
                currentTime + start + duration,
            );

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(currentTime + start);
            osc.stop(currentTime + start + duration);
        });
    }
}
