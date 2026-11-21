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

    const rawVolume = typeof options.volume === "number" ? options.volume : 0.8;
    const volume = Number.isFinite(rawVolume)
        ? Math.max(0, Math.min(1, rawVolume))
        : 0.8;

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
        // 電子アラーム音: 「ピピピッ、ピピピッ」 (短音のパルスを2セット)
        const beeps = [
            { start: 0.0, end: 0.08, freq: 880 * pitch },
            { start: 0.12, end: 0.2, freq: 880 * pitch },
            { start: 0.24, end: 0.32, freq: 880 * pitch },
            { start: 0.44, end: 0.52, freq: 880 * pitch },
            { start: 0.56, end: 0.64, freq: 880 * pitch },
            { start: 0.68, end: 0.76, freq: 880 * pitch },
        ];

        beeps.forEach(({ start, end, freq }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "square";
            osc.frequency.setValueAtTime(freq, currentTime + start);

            // クリックノイズ防止のための微小フェードイン・アウト
            gain.gain.setValueAtTime(0, currentTime + start);
            gain.gain.linearRampToValueAtTime(0.2, currentTime + start + 0.01);
            gain.gain.setValueAtTime(0.2, currentTime + end - 0.01);
            gain.gain.linearRampToValueAtTime(0, currentTime + end);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(currentTime + start);
            osc.stop(currentTime + end);
        });
    } else {
        // チャイム音: 「ポーン」 (サイン波による澄んだ鐘・チャイムのような減衰音)
        const notes = [
            { start: 0.0, duration: 1.0, freq: 523.25 * pitch }, // C5
            { start: 0.15, duration: 1.2, freq: 659.25 * pitch }, // E5
            { start: 0.3, duration: 1.5, freq: 783.99 * pitch }, // G5
        ];

        notes.forEach(({ start, duration, freq }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, currentTime + start);

            gain.gain.setValueAtTime(0, currentTime + start);
            gain.gain.linearRampToValueAtTime(0.25, currentTime + start + 0.02);
            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                currentTime + start + duration,
            );

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(currentTime + start);
            osc.stop(currentTime + start + duration);
        });
    }
}
